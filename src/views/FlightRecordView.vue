<template>
    <div class="record-page">
        <div class="header">
            <h2>🛩️ 飞行日志</h2>

            <div class="ops">
                <el-input-number v-model="limit" :min="1" :max="100" size="small" :step="5" controls-position="right"
                    class="mr-10" />
                <el-button type="primary" @click="loadLogs" :loading="loading">刷新</el-button>
            </div>
        </div>

        <el-scrollbar class="scroll" height="calc(100vh - 120px)">
            <div class="list">
                <FlightRecordItem v-for="log in logs" :key="log.id" :log="log" @delete="deleteLog" />

                <div v-if="logs.length === 0 && !loading" class="empty">
                    <el-empty description="暂无飞行日志" />
                </div>
            </div>
        </el-scrollbar>
    </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import FlightRecordItem from "@/components/FlightRecordItem.vue";
import { getFlightLogs, deleteFlightLogById } from "@/api/FlightLogs";

const logs = ref([])
const loading = ref(false)
const limit = ref(20)

const safeParseCoords = (str) => {
    try {
        const data = JSON.parse(str)
        return Array.isArray(data) ? data : []
    } catch (e) {
        console.warn("坐标解析失败:", str)
        return []
    }
}

const loadLogs = async () => {
    loading.value = true
    try {
        const userId = Number(localStorage.getItem("userID"))
        const res = await getFlightLogs({ user_id: userId, limit: limit.value })

        if (res.data?.success) {
            const list = Array.isArray(res.data.data) ? res.data.data : []

            //解析 coordinates 字段
            logs.value = list.map(log => ({
                ...log,
                coordinates: safeParseCoords(log.coordinates)
            }))
        }
    } catch (err) {
        console.error(err)
        ElMessage.error("获取飞行日志失败")
    } finally {
        loading.value = false
    }
}


const deleteLog = async (id) => {
    try {
        const res = await deleteFlightLogById(id)
        if (res.data?.success) {
            logs.value = logs.value.filter((l) => l.id !== id)
            ElMessage.success("删除成功")
        } else throw new Error(res.data?.message)
    } catch (err) {
        console.error(err)
        ElMessage.error("删除失败")
    }
}

onMounted(loadLogs)
</script>

<style scoped>
.record-page {
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

.scroll {
    flex: 1;
    background: #fff;
    border-radius: 12px;
    padding: 10px 20px;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.05);
}

.empty {
    margin-top: 80px;
    text-align: center;
}
</style>
