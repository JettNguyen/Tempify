// navigator.clipboard is missing or blocked in some webviews and on insecure
// origins, so fall back to a throwaway textarea before giving up. iOS refuses to
// copy from a readonly field and ignores select(), so the node has to be
// editable and selected through a Range as well as setSelectionRange().
function legacyCopy(text) {
  let area
  try {
    area = document.createElement('textarea')
    area.value = text
    area.contentEditable = 'true'
    area.readOnly = false
    area.style.position = 'fixed'
    area.style.top = '-9999px'
    area.style.opacity = '0'
    document.body.appendChild(area)

    const range = document.createRange()
    range.selectNodeContents(area)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    area.setSelectionRange(0, text.length)

    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    if (area?.parentNode) area.parentNode.removeChild(area)
  }
}

/** Copies text, and says whether it worked. */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path.
  }
  return legacyCopy(text)
}
