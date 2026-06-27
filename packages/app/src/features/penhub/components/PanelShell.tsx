import type { ParentProps } from "solid-js"

export function PanelShell(props: ParentProps<{ title: string; meta?: string }>) {
  return (
    <section class="min-w-0 rounded-md border border-v2-border-border-muted bg-v2-background-bg-layer-01">
      <header class="flex min-h-11 items-center justify-between gap-3 border-b border-v2-border-border-muted px-4 py-3">
        <h2 class="min-w-0 text-[13px] font-semibold uppercase tracking-normal text-v2-text-text-base">
          {props.title}
        </h2>
        {props.meta && <span class="shrink-0 text-[12px] text-v2-text-text-muted">{props.meta}</span>}
      </header>
      <div class="p-4">{props.children}</div>
    </section>
  )
}
