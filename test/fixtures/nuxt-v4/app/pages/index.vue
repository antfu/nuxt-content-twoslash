<script setup lang="ts">
const { data: home } = await useAsyncData(() => queryCollection('content').path('/').first())
</script>

<template>
  <ContentRenderer v-if="home" :value="home" />
  <div v-else>
    Home not found
  </div>
</template>
