<template>
    <div class="photo-album">
        <div class="header">
            <h2>📷 相册</h2>

            <div class="ops">
                <el-input-number v-model="limit" :min="1" :max="500" size="small" :step="5" controls-position="right"
                    class="mr-10" placeholder="数量" />
                <el-button type="primary" @click="loadPhotos" :loading="loading">刷新</el-button>
            </div>
        </div>

        <!-- 滚动容器 -->
        <el-scrollbar class="photo-scroll" height="calc(100vh - 120px)">
            <div class="photo-list-wrapper">
                <div class="photo-list">
                    <PhotoCard v-for="photo in photos" :key="photo.image_id" :photo="photo" @delete="deletePhoto"
                        @download="downloadPhoto" @edit="editPhotoDesc" @analyze="analyzeImage" />
                </div>

                <div v-if="photos.length === 0 && !loading" class="empty">
                    <el-empty description="暂无照片" />
                </div>
            </div>
        </el-scrollbar>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import PhotoCard from '@/components/PhotoCard.vue'
import { getPhotos, deletePhotoById, exportPhotoById, updatePhotoDesc, analyzePhoto } from '@/api/Photo.js'

const photos = ref([])
const loading = ref(false)
const limit = ref(30)

const loadPhotos = async () => {
    loading.value = true
    try {
        const userId = Number(localStorage.getItem('userID'))
        if (!userId) {
            photos.value = []
            ElMessage.warning('请登录后，再查看相册')
            return
        }

        const res = await getPhotos({ user_id: userId, limit: limit.value })
        if (res.data?.code === 200) {
            const data = Array.isArray(res.data.data) ? res.data.data : []
            photos.value = data
        } else throw new Error(res.data?.message || '获取照片失败')
    } catch (err) {
        console.error(err)
        ElMessage.error('获取照片失败，请稍后重试')
    } finally {
        loading.value = false
    }
}

const deletePhoto = async (image_id) => {
    try {
        const res = await deletePhotoById(image_id)
        if (res.data?.code === 200) {
            photos.value = photos.value.filter((p) => p.image_id !== image_id)
            ElMessage.success('删除成功')
        } else throw new Error(res.data?.message || '删除失败')
    } catch (err) {
        console.error(err)
        ElMessage.error('删除失败')
    }
}

const downloadPhoto = async (image_id) => {
    try {
        const res = await exportPhotoById(image_id)
        const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `images_${image_id}.jpg`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    } catch (err) {
        console.error(err)
        ElMessage.error('下载失败，请稍后重试')
    }
}

// 修改描述
const editPhotoDesc = async ({ image_id, newDesc }) => {
    try {
        const res = await updatePhotoDesc(image_id, newDesc)
        if (res.data?.code === 200) {
            const idx = photos.value.findIndex((p) => p.image_id === image_id)
            if (idx !== -1) {
                photos.value[idx].desc = res.data.data.new_desc
            }
            ElMessage.success('描述修改成功')
        } else throw new Error(res.data?.message || '修改失败')
    } catch (err) {
        console.error(err)
        ElMessage.error('修改描述失败')
    }
}
// 分析图片
const analyzeImage = async (image_id) => {
    try {
        const res = await analyzePhoto(image_id)
        if (res.data?.code === 200) {
            const idx = photos.value.findIndex((p) => p.image_id === image_id)
            if (idx !== -1) {
                photos.value[idx].desc = res.data.data.new_desc
            }
        } else throw new Error(res.data?.message || '分析失败')
    } catch (err) {
        console.error(err)
        ElMessage.error('分析失败')
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
    height: 100vh;
    display: flex;
    flex-direction: column;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.ops {
    display: flex;
    align-items: center;
}

.mr-10 {
    margin-right: 10px;
}

.photo-scroll {
    flex: 1;
    border-radius: 12px;
    background-color: #fff;
    padding: 10px 0;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.05);
}

.photo-scroll .el-scrollbar__wrap {
    overscroll-behavior: contain;
}

.photo-list-wrapper {
    width: 100%;
    padding: 0 20px;
    box-sizing: border-box;
}

.photo-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 20px;
}


@media (max-width: 800px) {
    .photo-list {
        grid-template-columns: 1fr;
    }
}

.empty {
    margin-top: 80px;
    text-align: center;
}
</style>