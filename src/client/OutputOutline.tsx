import { useEffect, useRef, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { STYLE_TEXT } from './styles.ts'

type Props = PropsRuntime<'shell.overlay'>

interface HeadingItem {
  id: string
  text: string
  level: number
}

interface AnswerItem {
  id: string
  preview: string
  headings: HeadingItem[]
}

interface TurnItem {
  key: string
  number: string
  userId: string | null
  userText: string
  answers: AnswerItem[]
}

const VISIBLE_KEY = 'dsh.outputOutline.visible'
const STYLE_ID = '@llq/dsh-output-outline'

function compactText(value: string, maximum = 120): string {
  const text = value.replace(/\s+/gu, ' ').trim()
    .replace(/(?:\d{1,2}月\d{1,2}日|\d{1,2}:\d{2}|\d+秒前|\d+分钟前|\d+小时前)$/u, '')
    .trim()
  return text.length <= maximum ? text : `${text.slice(0, maximum).trimEnd()}…`
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/gu, '-')
}

function isVisible(element: HTMLElement): boolean {
  return element.closest('[hidden]') === null
    && element.closest('[data-turn-process-hidden="true"]') === null
    && element.getClientRects().length > 0
}

function collectTurns(flow: HTMLElement): TurnItem[] {
  const wrappers = Array.from(flow.querySelectorAll<HTMLElement>('[data-chat-turn]'))
  const order: string[] = []
  const users = new Map<string, { id: string; text: string }>()
  const answers = new Map<string, HTMLElement[]>()

  for (const wrapper of wrappers) {
    const turn = wrapper.dataset.chatTurn
    if (turn === undefined) continue
    if (!order.includes(turn)) order.push(turn)

    if (wrapper.dataset.chatFlowKind === 'user' && !users.has(turn)) {
      const id = `dsh-outline-turn-${safeId(turn)}`
      wrapper.id = id
      users.set(turn, { id, text: compactText(wrapper.textContent ?? '') })
    }

    if (wrapper.dataset.chatFlowKind !== 'assistant-step'
      || wrapper.dataset.chatGroupPart !== 'response'
      || !isVisible(wrapper)) continue
    const list = answers.get(turn) ?? []
    if (!list.includes(wrapper)) list.push(wrapper)
    answers.set(turn, list)
  }

  return order.flatMap((turn, turnIndex) => {
    const turnAnswers = answers.get(turn) ?? []
    if (turnAnswers.length === 0) return []
    const answerItems = turnAnswers.map<AnswerItem>((answer, answerIndex) => {
      const id = `dsh-outline-answer-${safeId(turn)}-${answerIndex}`
      answer.id = id
      const headings = Array.from(answer.querySelectorAll<HTMLElement>('h1, h2, h3'))
        .flatMap<HeadingItem>((heading, headingIndex) => {
          const text = compactText(heading.textContent ?? '')
          if (text.length === 0) return []
          const headingId = `${id}-heading-${headingIndex}`
          heading.id = headingId
          return [{ id: headingId, text, level: Number(heading.tagName.slice(1)) }]
        })
      return {
        id,
        preview: compactText(answer.querySelector<HTMLElement>('p')?.textContent ?? answer.textContent ?? ''),
        headings,
      }
    })
    const user = users.get(turn)
    const numericTurn = Number(turn)
    return [{
      key: turn,
      number: Number.isFinite(numericTurn)
        ? String(numericTurn + 1).padStart(2, '0')
        : String(turnIndex + 1).padStart(2, '0'),
      userId: user?.id ?? null,
      userText: user?.text || `Turn ${turnIndex + 1}`,
      answers: answerItems,
    }]
  })
}

function findChat(): { flow: HTMLElement; scroll: HTMLElement } | null {
  const flows = Array.from(document.querySelectorAll<HTMLElement>('[data-chat-flow]'))
  const flow = flows.find(element => element.getClientRects().length > 0)
  if (flow === undefined) return null
  const scroll = flow.closest<HTMLElement>('[data-conversation-scroll]') ?? flow.parentElement
  return scroll === null ? null : { flow, scroll }
}

function scrollToTarget(id: string | null): void {
  if (id === null) return
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function labels(): { title: string; show: string; hide: string; empty: string } {
  return navigator.language.toLowerCase().startsWith('zh')
    ? { title: '输出大纲', show: '显示输出大纲', hide: '隐藏输出大纲', empty: '当前会话还没有可展示的回答' }
    : { title: 'Outline', show: 'Show outline', hide: 'Hide outline', empty: 'No answers to outline yet' }
}

export function OutputOutline(_props: Props) {
  const [visible, setVisible] = useState(() => localStorage.getItem(VISIBLE_KEY) !== 'false')
  const [turns, setTurns] = useState<TurnItem[]>([])
  const [activeTurn, setActiveTurn] = useState<string | null>(null)
  const [chatPresent, setChatPresent] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let scroll: HTMLElement | null = null

    const updateActive = () => {
      const chat = findChat()
      if (chat === null || turns.length === 0) return
      const viewport = chat.scroll.getBoundingClientRect()
      const focusY = viewport.top + (viewport.bottom - viewport.top) * 0.3
      const containing = turns.findLast(turn => turn.answers.some(answer => {
        const rect = document.getElementById(answer.id)?.getBoundingClientRect()
        return rect !== undefined && rect.top <= focusY && rect.bottom >= focusY
      }))
      if (containing !== undefined) {
        setActiveTurn(containing.key)
        return
      }
      const measured = turns.flatMap(turn => {
        const id = turn.userId ?? turn.answers[0]?.id
        const element = id === null || id === undefined ? null : document.getElementById(id)
        return element === null ? [] : [{ key: turn.key, top: element.getBoundingClientRect().top }]
      })
      const first = measured[0]
      if (first === undefined) return
      setActiveTurn(measured.reduce((best, item) => (
        Math.abs(item.top - focusY) < Math.abs(best.top - focusY) ? item : best
      ), first).key)
    }

    const collect = () => {
      const chat = findChat()
      setChatPresent(chat !== null)
      const next = chat === null ? [] : collectTurns(chat.flow)
      setTurns(next)
      setActiveTurn(current => next.some(turn => turn.key === current) ? current : next.at(-1)?.key ?? null)
      if (scroll !== chat?.scroll) {
        scroll?.removeEventListener('scroll', updateActive)
        scroll = chat?.scroll ?? null
        scroll?.addEventListener('scroll', updateActive, { passive: true })
      }
    }
    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(collect, 80)
    }

    collect()
    const observer = new MutationObserver(mutations => {
      const changedOutsideOutline = mutations.some(mutation => {
        const element = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement
        return element?.closest('.dsh-outline-panel,.dsh-outline-toggle') === null
      })
      if (changedOutsideOutline) schedule()
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] })
    window.addEventListener('resize', schedule)
    return () => {
      if (timer !== undefined) clearTimeout(timer)
      observer.disconnect()
      scroll?.removeEventListener('scroll', updateActive)
      window.removeEventListener('resize', schedule)
    }
  }, [turns.length])

  useEffect(() => {
    if (!visible || activeTurn === null) return
    listRef.current?.querySelector<HTMLElement>(`[data-outline-turn="${CSS.escape(activeTurn)}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeTurn, visible])

  if (!chatPresent) return null
  const copy = labels()
  const changeVisible = (next: boolean) => {
    setVisible(next)
    localStorage.setItem(VISIBLE_KEY, String(next))
  }

  if (!visible) {
    return <button className="dsh-outline-toggle" type="button" onClick={() => changeVisible(true)}>{copy.title}</button>
  }

  return (
    <aside className="dsh-outline-panel" aria-label={copy.title}>
      <header className="dsh-outline-header">
        <span className="dsh-outline-title"><span aria-hidden="true">☷</span>{copy.title}</span>
        <button type="button" className="dsh-outline-close" aria-label={copy.hide} onClick={() => changeVisible(false)}>×</button>
      </header>
      {turns.length === 0 ? <div className="dsh-outline-empty">{copy.empty}</div> : (
        <div ref={listRef} className="dsh-outline-list">
          {turns.map(turn => (
            <section key={turn.key} className="dsh-outline-turn" data-active={turn.key === activeTurn || undefined} data-outline-turn={turn.key}>
              <span className="dsh-outline-number">{turn.number}</span>
              <div className="dsh-outline-content">
                <button type="button" className="dsh-outline-user" title={turn.userText}
                  onClick={() => scrollToTarget(turn.userId ?? turn.answers[0]?.id ?? null)}>{turn.userText}</button>
                {turn.answers.map(answer => (
                  <div className="dsh-outline-answer" key={answer.id}>
                    <button type="button" className="dsh-outline-answer-jump" onClick={() => scrollToTarget(answer.id)}>A</button>
                    {answer.headings.length > 0 ? answer.headings.map(heading => (
                      <button key={heading.id} type="button" className="dsh-outline-heading" data-level={heading.level}
                        title={heading.text} onClick={() => scrollToTarget(heading.id)}>{heading.text}</button>
                    )) : (
                      <button type="button" className="dsh-outline-preview" title={answer.preview}
                        onClick={() => scrollToTarget(answer.id)}>{answer.preview || copy.empty}</button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <button type="button" className="dsh-outline-edge" aria-label={copy.hide} onClick={() => changeVisible(false)}>‹</button>
    </aside>
  )
}

export function installStyle(): () => void {
  if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return () => {}
  const style = document.createElement('style')
  style.dataset.pluginCss = STYLE_ID
  style.textContent = STYLE_TEXT
  document.head.appendChild(style)
  return () => style.remove()
}
