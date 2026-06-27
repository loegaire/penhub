export function ReportPreview(props: { markdown: string }) {
  return (
    <pre class="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-sm bg-v2-background-bg-layer-03 p-3 text-[12px] leading-5 text-v2-text-text-base">
      {props.markdown}
    </pre>
  )
}
