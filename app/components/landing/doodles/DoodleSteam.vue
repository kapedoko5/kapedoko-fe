<template>
  <svg class="doodle doodle-steam" viewBox="0 0 40 48" fill="none" aria-hidden="true" focusable="false">
    <g stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
      <path d="M10 44c-6-8 6-12 0-20s6-12 0-20" />
      <path d="M26 44c-6-8 6-12 0-20s6-12 0-20" />
    </g>
  </svg>
</template>

<style scoped>
.doodle { display: block; width: 100%; height: auto; color: var(--color-ink); overflow: visible; }
.doodle-steam path { animation: doodle-steam-rise 2.8s ease-in-out infinite; }
.doodle-steam path:nth-child(2) { animation-delay: 0.6s; }
@keyframes doodle-steam-rise {
  0%, 100% { opacity: 0.3; translate: 0 3px; }
  50% { opacity: 1; translate: 0 -3px; }
}
@media (prefers-reduced-motion: reduce) {
  .doodle-steam path { animation: none; opacity: 1; }
}
</style>
