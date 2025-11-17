<template>
    <el-card class="camera-card" shadow="hover">
        <div class="camera-content">
            <!-- 左侧：视频 -->
            <div class="camera-view">
                <img v-if="!isPreviewPaused" :src="videoStreamUrl" alt="摄像头实时画面" class="video-feed" />
                <div v-else class="paused-overlay">
                    <el-icon size="40">
                        <VideoPause />
                    </el-icon>
                    <span>摄像头已关闭</span>
                </div>
            </div>

            <!-- 右侧：控制区 -->
            <div class="camera-controls">
                <el-button type="primary" plain :loading="isPausing" @click="toggleCamera">
                    {{ isPreviewPaused ? "打开摄像头" : "关闭摄像头" }}
                </el-button>

                <el-tooltip content="拍摄" placement="bottom">
                    <el-button type="plain" circle :icon="CameraFilled" :loading="isCapturing"
                        :disabled="isPreviewPaused" @click="captureFrame" />
                </el-tooltip>
            </div>
        </div>
    </el-card>
</template>

<script setup>
import { ref, onMounted } from "vue";
import axios from "@/api/request";
import { ElMessage } from "element-plus";
import { CameraFilled, VideoPause, VideoCamera } from "@element-plus/icons-vue";

// 视频流 URL
const videoStreamUrl = "http://localhost:8000/api/v1/camera/stream";

const isPreviewPaused = ref(false);
const isPausing = ref(false);
const isCapturing = ref(false);

// 从 localStorage 读取用户信息
const userId = localStorage.getItem("userID") || 1;
const location = localStorage.getItem("location") || "(-,-)";

const toggleCamera = async () => {
    isPausing.value = true;
    try {
        const res = await axios.post("/v1/camera/toggle-pause");
        if (res.data.code === 200) {
            isPreviewPaused.value = res.data.data.paused;
            // ElMessage.success(res.data.message);
        } else {
            ElMessage.error(res.data.message || "操作失败");
        }
    } catch (err) {
        console.error("暂停/继续失败：", err);
        ElMessage.error("操作失败，请检查后端服务");
    } finally {
        isPausing.value = false;
    }
};

const captureFrame = async () => {
    isCapturing.value = true;
    try {
        const res = await axios.post("/v1/camera/capture", {
            user_id: Number(userId),
            desc: `手动拍摄（${new Date().toLocaleString()}）`,
            location: location,
        });
        if (res.data.code === 200) {
            ElMessage.success(`拍摄成功`);
        } else {
            ElMessage.error(res.data.message || "拍摄失败");
        }
    } catch (err) {
        console.error("拍摄失败：", err);
        ElMessage.error("拍摄失败，请检查后端服务");
    } finally {
        isCapturing.value = false;
    }
};

onMounted(() => {
    isPreviewPaused.value = true;
});
</script>

<style scoped>
.camera-card {
    width: 100%;
    height: 160px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

}

.camera-card ::v-deep(.el-card__body) {
    padding: 10px !important;
}

/* 内容布局：左右分布 */
.camera-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
    gap: 20px;
}

/* 左侧视频区域 */
.camera-view {
    position: relative;
    flex: 1;
    height: 140px;
    border-radius: 10px;
    overflow: hidden;
    background: #000;
    border: 1px solid #ccc;
    align-items: center;
}

.video-feed {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.paused-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 15px;
}

/* 右侧控制区 */
.camera-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 140px;
}

.camera-controls .el-button {
    width: 120px;
}
</style>
