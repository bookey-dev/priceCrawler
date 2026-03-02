<template>
  <div class="container">
    <h1>Diamond Price Crawler</h1>
    <p class="subtitle">Diamonds Factory - Lab-Created Diamond Prices</p>

    <SingleCrawl />
  </div>
</template>

<script setup lang="ts">
import SingleCrawl from './components/SingleCrawl.vue'
</script>

<style scoped>
.subtitle {
  color: #666;
  margin-bottom: 20px;
  font-size: 14px;
}
</style>
