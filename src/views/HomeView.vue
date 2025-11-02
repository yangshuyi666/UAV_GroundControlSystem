<template>
  <div class="page-container">
    <div class="map-wrapper">
      <MapContainer />
    </div>
  </div>
</template>

<script setup>
import MapContainer from '@/components/MapContainer.vue'
</script>

<style scoped>
.page-container {
  padding: 20px;
}

.map-wrapper {
  width: 100%;
  height: 500px;
  /* 控制地图显示高度 */
  border: 1px solid #ccc;
}
</style>