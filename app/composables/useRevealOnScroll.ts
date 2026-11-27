import type { Ref } from 'vue'

/**
 * Marks an element as revealed once it scrolls into view (fade + 12px rise via
 * the `.landing-reveal` / `.is-revealed` classes in landing.css). Reduced motion
 * and browsers without IntersectionObserver reveal immediately.
 */
export function useRevealOnScroll(target: Ref<HTMLElement | null>, options: { once?: boolean, threshold?: number } = {}) {
  const revealed = ref(false)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    const el = target.value
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!el || reduced || typeof IntersectionObserver === 'undefined') {
      revealed.value = true
      return
    }
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        revealed.value = true
        if (options.once !== false) {
          observer?.disconnect()
          observer = null
        }
      }
    }, { threshold: options.threshold ?? 0.15, rootMargin: '0px 0px -8% 0px' })
    observer.observe(el)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return { revealed }
}
