import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { OutputOutline, installStyle } from './OutputOutline.tsx'

export const name = 'output-outline'
export const inject = ['slots']

/** Mount the fixed historical conversation outline into DSH's frame overlay. */
export function apply(ctx: Context): void {
  ctx.effect(installStyle, 'output-outline: styles')
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'output-outline',
    order: 20,
  }, OutputOutline))
}
