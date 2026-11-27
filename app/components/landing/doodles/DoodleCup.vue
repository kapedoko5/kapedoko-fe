<template>
  <svg class="doodle doodle-cup" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    <path d="M12 26c0 0 1 22 18 22s18-22 18-22H12Z" fill="var(--color-paper-2)" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M48 30c6-1 9 3 7 7s-7 5-10 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    <path d="M8 53c8 3 36 3 46 0" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    <path d="M19 33c2 6 5 9 9 10" stroke="var(--color-accent)" stroke-width="2.5" stroke-linecap="round" />
    <g class="doodle-cup__steam" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
      <path d="M22 20c-3-4 3-6 0-11" />
      <path d="M31 19c-3-4 3-6 0-11" />
      <path d="M40 20c-3-4 3-6 0-11" />
    </g>
  </svg>
</template>

<style scoped>
.doodle { display: block; width: 100%; height: auto; color: var(--color-ink); overflow: visible; }
.doodle-cup__steam path { animation: doodle-steam 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: bottom; }
.doodle-cup__steam path:nth-child(2) { animation-delay: 0.4s; }
.doodle-cup__steam path:nth-child(3) { animation-delay: 0.8s; }
@keyframes doodle-steam {
  0%, 100% { opacity: 0.35; translate: 0 2px; }
  50% { opacity: 1; translate: 0 -2px; }
}
@media (prefers-reduced-motion: reduce) {
  .doodle-cup__steam path { animation: none; opacity: 1; }
}
</style>
