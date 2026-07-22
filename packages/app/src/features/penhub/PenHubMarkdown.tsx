import { Markdown } from "@opencode-ai/session-ui/markdown"
import { marked } from "marked"
import { createEffect, onCleanup, onMount } from "solid-js"

let diagramID = 0

export function PenHubMarkdown(props: {
  text: string
  cacheKey: string
  theme: "light" | "dark"
  fontSize: number
  streaming: boolean
}) {
  let root: HTMLDivElement | undefined
  let observer: MutationObserver | undefined
  let queue = Promise.resolve()
  const rendered = new WeakMap<HTMLElement, string>()

  const renderDiagrams = () => {
    const container = root
    if (!container || props.streaming || !/```mermaid(?:\s|$)/i.test(props.text)) return
    const languages = marked
      .lexer(props.text)
      .flatMap((token) => (token.type === "code" ? [token.lang?.split(/\s+/)[0] || "text"] : []))
    container.querySelectorAll<HTMLElement>('[data-component="markdown-code"]').forEach((block, index) => {
      const language = languages[index]
      if (language && block.dataset.language !== language) block.dataset.language = language
    })
    container
      .querySelectorAll<HTMLElement>('[data-component="markdown-code"][data-language="mermaid"]')
      .forEach((block) => {
        const source = block.querySelector("code")?.textContent?.trim()
        if (!source) return
        const key = `${props.theme}:${props.fontSize}\n${source}`
        if (rendered.get(block) === key) return
        rendered.set(block, key)
        queue = queue.then(async () => {
          const { default: mermaid } = await import("mermaid")
          mermaid.initialize({
            startOnLoad: false,
            suppressErrorRendering: true,
            securityLevel: "strict",
            theme: props.theme === "dark" ? "dark" : "neutral",
            fontFamily: "JetBrainsMono Nerd Font, JetBrains Mono, monospace",
            themeVariables: {
              fontSize: `${props.fontSize}px`,
              primaryColor: props.theme === "dark" ? "#15191b" : "#ecece8",
              primaryTextColor: props.theme === "dark" ? "#d9ddd9" : "#171816",
              primaryBorderColor: props.theme === "dark" ? "#777f7a" : "#71736f",
              lineColor: props.theme === "dark" ? "#d9ddd9" : "#171816",
            },
          })
          try {
            const result = await mermaid.render(`penhub-mermaid-${++diagramID}`, source)
            if (block.querySelector("code")?.textContent?.trim() !== source) return
            const diagram = document.createElement("div")
            diagram.className = "penhub-mermaid"
            diagram.setAttribute("role", "img")
            diagram.setAttribute("aria-label", "Mermaid diagram")
            diagram.innerHTML = result.svg
            block.querySelector(".penhub-mermaid")?.remove()
            block.appendChild(diagram)
            block.dataset.mermaidRendered = "true"
          } catch {
            const message = document.createElement("div")
            message.className = "penhub-mermaid-error"
            message.textContent = "Invalid Mermaid diagram. Showing source."
            block.querySelector(".penhub-mermaid-error")?.remove()
            block.appendChild(message)
            delete block.dataset.mermaidRendered
          }
        })
      })
  }

  createEffect(() => {
    props.text
    props.theme
    props.fontSize
    props.streaming
    queueMicrotask(renderDiagrams)
  })

  onMount(() => {
    if (!root) return
    observer = new MutationObserver(renderDiagrams)
    observer.observe(root, { childList: true, characterData: true, subtree: true })
    renderDiagrams()
  })

  onCleanup(() => observer?.disconnect())

  return (
    <div ref={root} class="penhub-markdown">
      <Markdown text={props.text} cacheKey={props.cacheKey} streaming={props.streaming} />
    </div>
  )
}
