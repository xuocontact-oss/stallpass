/** Marks example content so nobody mistakes it for a real market or vendor. */
export function SampleBadge() {
  return (
    <span
      title="Example content to show how Stallpass works. Not a real business or event."
      className="inline-flex items-center rounded-full border border-dashed border-violet-400 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-violet-700 uppercase"
    >
      Example
    </span>
  )
}
