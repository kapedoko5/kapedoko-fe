<template>
  <section class="analytics-section ledger" :aria-labelledby="titleId">
    <div class="analytics-section__head">
      <h2 :id="titleId">{{ title }}</h2>
      <slot name="controls" />
    </div>
    <p v-if="rows.length === 0" class="analytics-muted">{{ emptyText }}</p>
    <template v-else>
      <div class="admin-table-wrap ledger__table">
        <table class="admin-table">
          <thead>
            <tr>
              <th
                v-for="column in columns"
                :key="column.key"
                scope="col"
                :aria-sort="sortKey === column.key
                  ? (sortDir === 'asc' ? 'ascending' : 'descending')
                  : 'none'"
              >
                <button
                  type="button"
                  class="ledger__sort"
                  :class="{ 'is-active': sortKey === column.key }"
                  :aria-label="sortColumnLabel(column)"
                  @click="emit('sort', column.key)"
                >
                  {{ column.label }}
                  <span v-if="sortKey === column.key" class="ledger__mark" aria-hidden="true">{{ sortDir === 'desc' ? '↓' : '↑' }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>
                <NuxtLink v-if="row.href" class="ledger__link" :to="row.href">{{ row.name }}</NuxtLink>
                <template v-else>{{ row.name }}</template>
              </td>
              <td v-for="column in valueColumns" :key="column.key">{{ row.cells[column.key] ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="ledger__cards">
        <article v-for="row in rows" :key="row.id" class="ledger__card">
          <h3>
            <NuxtLink v-if="row.href" class="ledger__link" :to="row.href">{{ row.name }}</NuxtLink>
            <template v-else>{{ row.name }}</template>
          </h3>
          <dl class="ledger__facts">
            <div v-for="column in valueColumns" :key="column.key">
              <dt>{{ column.label }}</dt>
              <dd>{{ row.cells[column.key] ?? '—' }}</dd>
            </div>
          </dl>
        </article>
      </div>
    </template>
    <slot name="footer" />
  </section>
</template>

<script lang="ts" setup>
import type { TrafficSortDir, TrafficSortKey } from '~/utils/shop-traffic'

export type LedgerColumn = { key: TrafficSortKey, label: string }
export type LedgerRow = {
  id: string
  name: string
  href?: string
  cells: Partial<Record<TrafficSortKey, string>>
}

const props = defineProps<{
  title: string
  titleId: string
  columns: LedgerColumn[]
  rows: LedgerRow[]
  sortKey: TrafficSortKey
  sortDir: TrafficSortDir
  emptyText: string
}>()

const emit = defineEmits<{ sort: [key: TrafficSortKey] }>()

const valueColumns = computed(() => props.columns.filter((column) => column.key !== 'name'))

const sortColumnLabel = (column: LedgerColumn) => {
  const active = props.sortKey === column.key
  if (column.key === 'name') {
    if (!active) return `Sort by ${column.label}, A to Z`
    return props.sortDir === 'asc' ? `Sort by ${column.label}, Z to A` : `Sort by ${column.label}, A to Z`
  }
  if (!active) return `Sort by ${column.label}, highest first`
  return props.sortDir === 'desc'
    ? `Sort by ${column.label}, lowest first`
    : `Sort by ${column.label}, highest first`
}
</script>

<style scoped>
.ledger__table {
  margin: 0 -16px;
  border: 0;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
  border-radius: 0;
  background: transparent;
}

.ledger__cards {
  display: none;
}

.ledger__sort {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  margin: -12px -16px;
  padding: 12px 16px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.ledger__sort:focus-visible,
.ledger__link:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.ledger__sort.is-active {
  color: var(--kd-ink);
}

.ledger__mark {
  font-weight: 700;
  line-height: 1;
}

.ledger__link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin: -12px -16px;
  padding: 12px 16px;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
}

.ledger__link:hover {
  color: var(--kd-primary);
}

.ledger__card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0 12px;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.ledger__card h3 {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.2;
}

.ledger__card .ledger__link {
  margin: 0 -4px;
  padding: 0 4px;
}

.ledger__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
  margin: 0;
}

.ledger__facts div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.ledger__facts dt {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
}

.ledger__facts dd {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 767px) {
  .ledger__table {
    display: none;
  }

  .ledger__cards {
    display: grid;
    gap: 4px;
  }
}
</style>
