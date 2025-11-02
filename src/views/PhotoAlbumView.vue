<template>
    <div class="photo-album">
        <div class="header">
            <h2>📷 照片相册</h2>
            <el-button type="primary" @click="loadPhotos" :loading="loading">刷新</el-button>
        </div>

        <el-row :gutter="20">
            <el-col v-for="photo in photos" :key="photo.id" :xs="24" :sm="12" :md="8" :lg="6" :xl="4">
                <PhotoCard :photo="photo" @delete="deletePhoto" />
            </el-col>
        </el-row>

        <div v-if="photos.length === 0 && !loading" class="empty">
            <el-empty description="暂无照片" />
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import PhotoCard from '@/components/PhotoCard.vue'
import { getPhotos, deletePhotoById } from '@/api/Photo.js'

const photos = ref([])
const loading = ref(false)

const loadPhotos = async () => {
    loading.value = true
    try {
        const res = await getPhotos()
        photos.value = res.data || []
    } catch (err) {
        ElMessage.error('获取照片失败，请稍后重试')
    } finally {
        loading.value = false
    }
}

const deletePhoto = async (id) => {
    try {
        await deletePhotoById(id)
        photos.value = photos.value.filter(p => p.id !== id)
        ElMessage.success('删除成功')
    } catch {
        ElMessage.error('删除失败')
    }
}

onMounted(() => {
    loadPhotos()
})
</script>

<style scoped>
.photo-album {
    padding: 20px;
    background: #f5f9ff;
    min-height: 100vh;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.empty {
    margin-top: 50px;
}
</style>
