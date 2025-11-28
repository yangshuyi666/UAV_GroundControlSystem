<template>
    <div class="record-card">
        <el-card class="log-item" shadow="hover">
            <div class="row">

                <!-- 信息区域 -->
                <div class="info">
                    <div class="title">
                        <span class="label">飞行日志 #{{ log.id }}</span>
                    </div>

                    <div class="field">
                        <span class="key">创建时间：</span>
                        <span class="value">{{ log.create_time }}</span>
                    </div>

                    <div class="field">
                        <span class="key">起点：</span>
                        <span class="value">({{ startPoint[1] }}, {{ startPoint[0] }})</span>
                    </div>

                    <div class="field">
                        <span class="key">终点：</span>
                        <span class="value">({{ endPoint[1] }}, {{ endPoint[0] }})</span>
                    </div>
                </div>

                <!-- 按钮区域 -->
                <div class="ops">
                    <el-button size="small" type="primary" @click="open">复现</el-button>
                    <el-button size="small" type="danger" @click="confirmDelete">删除</el-button>
                </div>

            </div>
        </el-card>

        <!-- 复现弹窗 -->
        <el-dialog v-model="replayVisible" title="飞行日志复现" width="70%" top="5vh" @opened="onDialogOpened"
            @closed="onDialogClosed">
            <div ref="mapEl" class="map"></div>
        </el-dialog>
    </div>

</template>

<script setup>
import { ref, nextTick, computed, onBeforeUnmount } from "vue"
import { ElMessageBox, ElMessage } from "element-plus"
import uavIcon from "@/assets/UAV3.png"

const props = defineProps({
    log: { type: Object, required: true }
})
const emits = defineEmits(["delete"])

const replayVisible = ref(false)
const mapEl = ref(null)

let map = null
let marker = null
let polyline = null

// 起点终点（原始为 [lat, lng]）
const startPoint = computed(() => props.log.coordinates[0])
const endPoint = computed(() => props.log.coordinates.at(-1))

// 转为高德需要的 [lng, lat]
const pathLngLat = computed(() =>
    (props.log.coordinates || []).map(([lat, lng]) => [lng, lat])
)

// 删除
const confirmDelete = () => {
    ElMessageBox.confirm("确认删除该飞行日志？", "提示", {
        type: "warning",
    }).then(() => {
        emits("delete", props.log.id)
    }).catch(() => { })
}

const open = () => {
    replayVisible.value = true
}

async function initMap() {
    if (!mapEl.value) return
    if (!pathLngLat.value?.length) {
        ElMessage.error("该日志没有有效的坐标点")
        return
    }
    const AMap = window.AMap
    if (!AMap) {
        ElMessage.error("未检测到 AMap，请确认 index.html 已正确引入高德 JSAPI")
        return
    }

    try {
        // 确保 MoveAnimation 插件可用
        await new Promise((res) => AMap.plugin("AMap.MoveAnimation", res))

        map = new AMap.Map(mapEl.value, {
            viewMode: "2D",
            zoom: 16,
            center: pathLngLat.value[0],
            mapStyle: "amap://styles/normal",
        })

        // 路径折线
        polyline = new AMap.Polyline({
            path: pathLngLat.value,
            strokeColor: "#1677ff",
            strokeWeight: 6,
            showDir: true,
            lineJoin: "round",
        })
        map.add(polyline)

        // 无人机图标
        marker = new AMap.Marker({
            position: pathLngLat.value[0],
            anchor: "bottom-center",
            icon: new AMap.Icon({
                image: uavIcon,
                imageSize: new AMap.Size(32, 32),
            }),
        })
        map.add(marker)

        // 调整视野以完整包含路径
        map.setFitView([polyline, marker], true, [50, 50, 50, 50])
    } catch (err) {
        console.error(err)
        ElMessage.error("初始化地图失败，请检查高德 JSAPI 与插件加载")
    }
}

function onDialogOpened() {
    nextTick(() => initMap())
}

function onDialogClosed() {
    destroyMap()
}

function destroyMap() {
    try {
        if (marker) {
            marker.stopMove && marker.stopMove()
            marker.setMap && marker.setMap(null)
            marker = null
        }
        if (polyline) {
            polyline.setMap && polyline.setMap(null)
            polyline = null
        }
        if (map) {
            map.destroy && map.destroy()
            map = null
        }
    } catch (e) {
        // ignore
    }
}

onBeforeUnmount(() => {
    destroyMap()
})

</script>

<style scoped>
.record-card {
    padding: 16px 20px;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    border: 1px solid #f0f0f0;
}


.log-item {
    padding: 16px 20px;
    border-radius: 10px;
}


.row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}


.info {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.title .label {
    font-size: 16px;
    font-weight: 600;
    color: #333;
}

.field {
    font-size: 14px;
    color: #444;
}

.key {
    font-weight: 500;
    color: #666;
}


.ops {
    display: flex;
    flex-direction: row;
    gap: 12px;
}

.ops .el-button {
    width: 80px;
    height: 32px;
}


.map {
    width: 100%;
    height: 500px;
    border-radius: 8px;
}
</style>