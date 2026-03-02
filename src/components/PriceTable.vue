<template>
  <div class="card">
    <div class="flex flex-between flex-center mb-20">
      <h2>Crawled Prices</h2>
      <div class="flex gap-10 flex-center">
        <span class="text-muted" v-if="lastCrawlTime">
          Last crawl: {{ formatDate(lastCrawlTime) }}
        </span>
        <span class="text-muted">
          Total: {{ filteredPrices.length }} items
        </span>
      </div>
    </div>

    <div class="filters mb-20">
      <div class="filter-row">
        <div class="filter-group">
          <label>Shape</label>
          <select v-model="filters.shape">
            <option value="">All</option>
            <option v-for="shape in DIAMOND_OPTIONS.shapes" :key="shape.value" :value="shape.value">
              {{ shape.label }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Carat</label>
          <select v-model="filters.carat">
            <option value="">All</option>
            <option v-for="carat in DIAMOND_OPTIONS.carats" :key="carat" :value="carat">
              {{ carat }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Clarity</label>
          <select v-model="filters.clarity">
            <option value="">All</option>
            <option v-for="clarity in DIAMOND_OPTIONS.clarities" :key="clarity" :value="clarity">
              {{ clarity }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Color</label>
          <select v-model="filters.color">
            <option value="">All</option>
            <option v-for="color in DIAMOND_OPTIONS.colors" :key="color" :value="color">
              {{ color }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Cut Grade</label>
          <select v-model="filters.cutGrade">
            <option value="">All</option>
            <option v-for="cut in DIAMOND_OPTIONS.cutGrades" :key="cut.value" :value="cut.value">
              {{ cut.label }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Certificate</label>
          <select v-model="filters.certificate">
            <option value="">All</option>
            <option v-for="cert in DIAMOND_OPTIONS.certificates" :key="cert.value" :value="cert.value">
              {{ cert.label }}
            </option>
          </select>
        </div>

        <button class="btn btn-primary" @click="clearFilters">Clear Filters</button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else-if="filteredPrices.length === 0" class="empty-state">
      <p>No price data available. Click "Manual Crawl Now" to start collecting data.</p>
    </div>

    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th @click="sort('sku')" class="sortable">
              SKU
              <span v-if="sortBy === 'sku'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="sort('config.shape')" class="sortable">
              Shape
              <span v-if="sortBy === 'config.shape'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="sort('config.carat')" class="sortable">
              Carat
              <span v-if="sortBy === 'config.carat'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="sort('config.clarity')" class="sortable">
              Clarity
              <span v-if="sortBy === 'config.clarity'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="sort('config.color')" class="sortable">
              Color
              <span v-if="sortBy === 'config.color'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="sort('config.cutGrade')" class="sortable">
              Cut Grade
              <span v-if="sortBy === 'config.cutGrade'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="sort('config.certificate')" class="sortable">
              Certificate
              <span v-if="sortBy === 'config.certificate'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="sort('price')" class="sortable">
              Price (GBP)
              <span v-if="sortBy === 'price'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in paginatedPrices" :key="item.id">
            <td>{{ item.sku }}</td>
            <td>{{ getShapeLabel(item.config.shape) }}</td>
            <td>{{ item.config.carat }}</td>
            <td>{{ item.config.clarity }}</td>
            <td>{{ item.config.color }}</td>
            <td>{{ getCutGradeLabel(item.config.cutGrade) }}</td>
            <td>{{ getCertificateLabel(item.config.certificate) }}</td>
            <td class="price">{{ item.price ? `£${item.price.toLocaleString()}` : 'N/A' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <button
          class="btn"
          @click="currentPage--"
          :disabled="currentPage === 1"
        >
          Previous
        </button>
        <span>Page {{ currentPage }} of {{ totalPages }}</span>
        <button
          class="btn"
          @click="currentPage++"
          :disabled="currentPage === totalPages"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { DIAMOND_OPTIONS, type DiamondPrice } from '@/types/diamond'

const props = defineProps<{
  prices: DiamondPrice[]
  loading: boolean
  lastCrawlTime?: Date | string
}>()

const filters = reactive({
  shape: '',
  carat: '',
  clarity: '',
  color: '',
  certificate: '',
  cutGrade: ''
})

const sortBy = ref<string>('price')
const sortOrder = ref<'asc' | 'desc'>('asc')
const currentPage = ref(1)
const pageSize = 50

const filteredPrices = computed(() => {
  let result = [...props.prices]

  if (filters.shape) {
    result = result.filter(p => p.config.shape === filters.shape)
  }
  if (filters.carat) {
    result = result.filter(p => p.config.carat === filters.carat)
  }
  if (filters.clarity) {
    result = result.filter(p => p.config.clarity === filters.clarity)
  }
  if (filters.color) {
    result = result.filter(p => p.config.color === filters.color)
  }
  if (filters.certificate) {
    result = result.filter(p => p.config.certificate === filters.certificate)
  }
  if (filters.cutGrade) {
    result = result.filter(p => p.config.cutGrade === filters.cutGrade)
  }

  // Sort
  result.sort((a, b) => {
    let aVal: any, bVal: any

    if (sortBy.value.startsWith('config.')) {
      const key = sortBy.value.replace('config.', '') as keyof typeof a.config
      aVal = a.config[key]
      bVal = b.config[key]
    } else {
      aVal = (a as any)[sortBy.value]
      bVal = (b as any)[sortBy.value]
    }

    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder.value === 'asc' ? aVal - bVal : bVal - aVal
    }

    const comparison = String(aVal).localeCompare(String(bVal))
    return sortOrder.value === 'asc' ? comparison : -comparison
  })

  return result
})

const totalPages = computed(() => Math.ceil(filteredPrices.value.length / pageSize))

const paginatedPrices = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredPrices.value.slice(start, start + pageSize)
})

watch(filters, () => {
  currentPage.value = 1
})

function sort(field: string) {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
}

function clearFilters() {
  filters.shape = ''
  filters.carat = ''
  filters.clarity = ''
  filters.color = ''
  filters.certificate = ''
  filters.cutGrade = ''
}

function getShapeLabel(value: string): string {
  const shape = DIAMOND_OPTIONS.shapes.find(s => s.value === value)
  return shape ? shape.label : value
}

function getCutGradeLabel(value: string): string {
  const cut = DIAMOND_OPTIONS.cutGrades.find(c => c.value === value)
  return cut ? cut.label : value
}

function getCertificateLabel(value: string): string {
  const cert = DIAMOND_OPTIONS.certificates.find(c => c.value === value)
  return cert ? cert.label : value
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString()
}
</script>

<style scoped>
.filter-row {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-group label {
  font-size: 12px;
  color: #666;
}

.filter-group select {
  min-width: 100px;
}

.table-container {
  overflow-x: auto;
}

.sortable {
  cursor: pointer;
  user-select: none;
}

.sortable:hover {
  background-color: #e9ecef;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #888;
}
</style>
