<template>
  <div class="activity">
    <p v-if="error" :class="emptyClass">{{ error }}</p>
    <p v-else-if="events.length === 0 && status !== 'loading'" :class="emptyClass">{{ emptyText }}</p>
    <template v-else>
      <div class="admin-table-wrap activity__table">
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th v-if="showCafe" scope="col">Cafe</th>
              <th scope="col">What</th>
              <th v-if="showWhere" scope="col">Where</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in events" :key="row.id">
              <td>{{ formatTrafficWhen(row.created_at) }}</td>
              <td v-if="showCafe">
                <NuxtLink class="activity__link" :to="cafeHref(row.shop_id)">{{ nameFor(row.shop_id) }}</NuxtLink>
              </td>
              <td>{{ shopTrafficKindLabel(row.kind) }}</td>
              <td v-if="showWhere">{{ shopTrafficSurfaceLabel(row.surface) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="activity__cards">
        <article v-for="row in events" :key="row.id" class="activity__card">
          <h3 v-if="showCafe">
            <NuxtLink class="activity__link" :to="cafeHref(row.shop_id)">{{ nameFor(row.shop_id) }}</NuxtLink>
          </h3>
          <h3 v-else>{{ shopTrafficKindLabel(row.kind) }}</h3>
          <dl class="activity__facts">
            <div v-if="showCafe">
              <dt>What</dt>
              <dd>{{ shopTrafficKindLabel(row.kind) }}</dd>
            </div>
            <div v-if="showWhere">
              <dt>Where</dt>
              <dd>{{ shopTrafficSurfaceLabel(row.surface) }}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>{{ formatTrafficWhen(row.created_at) }}</dd>
            </div>
          </dl>
        </article>
      </div>
      <button
        v-if="!done"
        type="button"
        :class="tone === 'admin' ? 'admin-btn' : 'owner-btn'"
        :disabled="status === 'loading'"
        @click="emit('more')"
      >
        {{ status === 'loading' ? 'Loading…' : 'Load more' }}
      </button>
    </template>
  </div>
</template>

<script lang="ts" setup>
import {
  formatTrafficWhen,
  shopTrafficKindLabel,
  shopTrafficSurfaceLabel,
  type ShopTrafficEventRow,
} from '~/utils/shop-traffic'

const props = defineProps<{
  tone: 'admin' | 'owner'
  events: ShopTrafficEventRow[]
  done: boolean
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string
  emptyText: string
  showCafe: boolean
  showWhere: boolean
  nameFor: (shopId: string) => string
  cafeHref: (shopId: string) => string
}>()

const emit = defineEmits<{ more: [] }>()

const emptyClass = computed(() => (props.tone === 'admin' ? 'admin-empty' : 'owner-empty'))
</script>

<style scoped>
.activity {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.activity > * {
  max-width: 100%;
}

.activity > .admin-table-wrap,
.activity > .activity__cards,
.activity > .admin-empty,
.activity > .owner-empty {
  align-self: stretch;
}

.activity__cards {
  display: none;
}

.activity__link {
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

.activity__link:hover {
  color: var(--kd-primary);
}

.activity__link:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.activity__card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.activity__card h3 {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.2;
}

.activity__card .activity__link {
  margin: 0 -4px;
  padding: 0 4px;
}

.activity__facts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
}

.activity__facts div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.activity__facts dt {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
}

.activity__facts dd {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
}

@media (max-width: 767px) {
  .activity__table {
    display: none;
  }

  .activity__cards {
    display: grid;
    gap: 12px;
  }
}
</style>
