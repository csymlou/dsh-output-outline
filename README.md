# DSH Output Outline

A DeepSeek Harness Web client plugin that adds a fixed, Pi Web-style outline for the complete loaded conversation history.

## Features

- Groups the outline by historical turn.
- Shows the user prompt and every assistant answer in that turn.
- Shows Markdown `h1`–`h3` headings, or the first answer paragraph when no heading exists.
- Updates while the assistant is streaming.
- Highlights the turn currently being read.
- Clicks navigate to a historical prompt, answer, or heading.
- The panel stays fixed while the transcript scrolls.
- Hover or focus the **Outline** button to preview the panel; leaving the panel or moving focus outside hides it.
- Clicking or double-clicking the transcript never toggles the panel, so native text selection remains unchanged.
- Uses DSH semantic design tokens and mounts through the additive `shell.overlay` slot.
- Does not patch or replace `ui-chat`.

The plugin can only outline history already loaded by DSH. When DSH pages older history into the transcript, the plugin discovers it automatically.

## Compatibility

Developed and tested against:

```text
@deepseek-ai/dsh 0.2.0-rc.2
```

The implementation reads the stable transcript markers currently emitted by DSH Web:

```text
data-chat-flow
data-chat-turn
data-chat-flow-kind
data-chat-group-part
```

A future DSH release that changes these markers may require an adapter update.

## Development

```bash
npm install
npm run check
```

Build artifacts:

```text
lib/index.js   Host plugin half
lib/client.js  Browser client bundle
```

## Local installation

Install the absolute repository path from **Plugins → Add plugin**, or use the CLI:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-output-outline-plugin
```

Then enable the installed **Conversation Outline** bundle in the Plugins page. Restart DSH if the running profile does not have HMR.

After publication, install it by package name:

```bash
dsh plugin --profile web add dsh-output-outline-plugin
```

For direct profile composition, add its bundle patch to the profile according to your DSH deployment's plugin-manager workflow. The package exports:

```text
dsh-output-outline-plugin/cordis.patch.yml
```

## Architecture

The package has a no-op Host half and an independently loaded Browser half. The Browser plugin registers one additive entry:

```ts
ctx.slots.inject('shell.overlay', () =>
  ctx.slots.register({
    name: 'shell.overlay',
    id: 'output-outline',
  }, OutputOutline)
)
```

The component observes only the active Chat transcript DOM. It does not mutate Session records or model requests.

## Model Experience

None, as this package only presents browser-side Session history already rendered by DSH.

#### KV Cache effect

None; the plugin neither assembles nor sends model requests.

## Known Limitations and Deferred Work

- **Loaded history only** — turns not yet paged into the browser cannot appear until DSH loads them.
- **DOM marker dependency** — a DSH release that changes the documented `data-chat-*` transcript markers may require an update.
- **Right-side overlap** — the plugin uses a fixed overlay so it does not replace DSH's single `rightbar` slot; opening another right-side surface may visually overlap it.

## License

MIT
