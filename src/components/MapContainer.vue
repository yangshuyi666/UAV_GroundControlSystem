<template>
    <el-row>
        <el-col :span="16">
            <div id="Container"></div>
        </el-col>

        <el-col :span="8" style="padding: 20px; display: flex; flex-direction: column; gap: 10px;">
            <!-- 无人机状态面板 -->
            <div class="uav-status">
                <h3>无人机状态</h3>
                <div v-if="uavStatus">
                    <div>位置：{{ (uavStatus.lat ?? 0).toFixed(6) }}, {{ (uavStatus.lng ?? 0).toFixed(6) }}</div>
                    <div>高度：{{ uavStatus.altitude ?? '—' }} m</div>
                    <div>速度：{{ uavStatus.speed ?? '—' }} km/h</div>
                    <div>电量：{{ uavStatus.battery ?? '—' }}%</div>
                    <div>状态：
                        <b
                            :style="{ color: uavStatus.status === 'flying' ? '#1677ff' : (uavStatus.status === 'paused' ? '#fa8c16' : '#666') }">
                            {{ uavStatus.status || '—' }}
                        </b>
                    </div>
                    <div>时间：{{ uavStatus.timestamp || '—' }}</div>
                </div>
                <div v-else>等待连接或飞行未开始</div>
            </div>

            <!-- 飞行参数 -->
            <div class="uav-params">
                <div class="param-item">
                    <span class="label">用户ID</span>
                    <el-input-number v-model="userId" :min="1" :step="1" controls-position="right" />
                </div>
                <div class="param-item">
                    <span class="label">速度(km/h)</span>
                    <el-input-number v-model="speed" :min="1" :max="100" :step="1" controls-position="right" />
                </div>
            </div>

            <el-button id="PlanStart" type="primary" :disabled="store.state.isPlanning || isFlying"
                @click="startPlanning">
                开始规划
            </el-button>

            <el-button id="PlanClear" type="warning" @click="clearPlanning"
                :disabled="store.state.isPlanning || isFlying">
                清空规划
            </el-button>

            <!-- 开始飞行：改为后端驱动 + WebSocket 推送 -->
            <el-button id="StartFly" type="success" @click="startFly" :disabled="store.state.isPlanning">
                开始飞行
            </el-button>

            <el-button id="PauseFly" type="info" @click="pauseFly" :disabled="!isFlying || isPaused">
                暂停飞行
            </el-button>

            <el-button id="ResumeFly" type="primary" @click="resumeFly" :disabled="!isFlying || !isPaused">
                继续飞行
            </el-button>

            <el-button id="StopFly" type="danger" @click="stopFly" :disabled="!isFlying">
                终止飞行
            </el-button>
        </el-col>
    </el-row>
</template>

<script setup>
import { onMounted, ref, watch, onUnmounted } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import axios from "@/api/request";

import StartIcon from "@/assets/StartPoint.png";
import EndIcon from "@/assets/EndPoint.png";
import MidIcon from "@/assets/MidPoint.png";
import uavIcon from "@/assets/UAV3.png";

const store = useStore();

let map = null;
let satelliteLayer = null;
let markers = [];
let line = null;
let distanceTexts = [];
let totalText = null;
let isEditing = false;

// === 无人机状态 & 后端交互 ===
let uavMarker = null;          // 无人机Marker
let passedPolyline = null;     // 已飞过路径
let ws = null;                 // WebSocket 连接
let lastPathLength = 0;        // 已追加的轨迹点数（性能优化）
const isFlying = ref(false);
const isPaused = ref(false);
const uavStatus = ref(null);
const userId = ref(Number(localStorage.getItem("userID")) || 1);
const speed = ref(5);

// ========== 初始化地图 ==========
onMounted(() => {
    if (!window.AMap) {
        console.error("AMap SDK 未加载");
        return;
    }

    map = new AMap.Map("Container", {
        center: [118.790784, 31.937422],
        zoom: 16,
        viewMode: "3D",
        pitch: 45,
        mapStyle: "amap://styles/normal",
        keyboardEnable: false,
    });

    // 工具控件初始化
    AMap.plugin(["AMap.ToolBar", "AMap.ControlBar", "AMap.HawkEye"], () => {
        map.addControl(new AMap.ToolBar({ position: "LB" }));
        map.addControl(new AMap.ControlBar({ position: "RT" }));
        const hawkEye = new AMap.HawkEye({
            position: "RB",
            width: "120px",
            height: "120px",
            showRectangle: true,
            autoMove: true,
            borderRadius: "10px",
        });
        map.addControl(hawkEye);
    });

    updateMapStyle(store.state.mapStyle);
    setTimeout(restorePlanningData, 500);
});

// ========== 图层样式监听 ==========
watch(() => store.state.mapStyle, (newStyle) => updateMapStyle(newStyle));

function updateMapStyle(style) {
    if (!map || !AMap) return;
    if (!satelliteLayer) satelliteLayer = new AMap.TileLayer.Satellite();
    // 下方 hasLayer 在旧版 AMap 可能不可用，若报错可直接 add/remove 不做判断
    if (style === "satellite") {
        if (!map.hasLayer || !map.hasLayer(satelliteLayer)) map.add(satelliteLayer);
    } else {
        if (!map.hasLayer || map.hasLayer(satelliteLayer)) map.remove(satelliteLayer);
    }
}

// ========================================================================
// 规划模式控制
// ========================================================================
function startPlanning() {
    if (isFlying.value) {
        ElMessage.warning("飞行进行中，无法开始规划！");
        return;
    }

    // 清除无人机与飞行轨迹
    if (uavMarker) {
        map.remove(uavMarker);
        uavMarker = null;
    }
    if (passedPolyline) {
        map.remove(passedPolyline);
        passedPolyline = null;
    }

    store.commit("setIsPlanning", true);
    setEditing(true);

    // 若已有路径，让节点可编辑
    markers.forEach(marker => {
        marker.setDraggable(true);
        marker.setCursor("move");

        if (marker._handlers) {
            marker.on("rightclick", marker._handlers.handleRightClick);
            marker.on("dragend", marker._handlers.handleDragEnd);
        } else {
            const handleDragEnd = () => { redrawPath(); savePlanningData(); };
            const handleRightClick = () => removeMarker(marker);
            marker._handlers = { handleRightClick, handleDragEnd };
            marker.on("dragend", handleDragEnd);
            marker.on("rightclick", handleRightClick);
        }
    });

    ElMessage.info("请在地图上点击添加航点（右键结束）");
}

function endPlanning() {
    store.commit("setIsPlanning", false);
    setEditing(false);
    disableMarkers();
    ElMessage.success("路径规划已结束。");
}

function setEditing(enabled) {
    isEditing = enabled;
    map.off("click", handleAddPoint);
    map.off("rightclick", handleEndPath);

    if (enabled) {
        map.on("click", handleAddPoint);
        map.on("rightclick", handleEndPath);
    }
}

// ========================================================================
// 节点操作逻辑
// ========================================================================
function handleAddPoint(e) {
    if (!isEditing) return;

    const position = e.lnglat;
    const index = markers.length;
    let text = index === 0 ? "起" : "经";

    const marker = new AMap.Marker({
        position,
        draggable: true,
        cursor: "move",
        icon: createTextIcon(text),
        anchor: "bottom-center",
    });

    // 注册事件并存引用
    const handleDragEnd = () => { redrawPath(); savePlanningData(); };
    const handleRightClick = () => removeMarker(marker);
    marker.on("dragend", handleDragEnd);
    marker.on("rightclick", handleRightClick);
    marker._handlers = { handleDragEnd, handleRightClick };

    map.add(marker);
    markers.push(marker);

    updateMarkerTypes();
    redrawPath();
    savePlanningData();
}

function removeMarker(marker) {
    map.remove(marker);
    markers.splice(markers.indexOf(marker), 1);
    updateMarkerTypes();
    redrawPath();
    savePlanningData();
}

function handleEndPath() {
    if (markers.length >= 2) {
        updateMarkerTypes();
        redrawPath();
        savePlanningData();
        endPlanning();
    } else {
        ElMessage.warning("路径点不足（至少2个）");
    }
}

function updateMarkerTypes() {
    if (markers.length === 0) return;

    // 全部设为“经”
    markers.forEach(m => m.setIcon(createTextIcon("经")));

    // 起点、终点特殊
    if (markers.length > 0)
        markers[0].setIcon(createTextIcon("起"));
    if (markers.length > 1)
        markers[markers.length - 1].setIcon(createTextIcon("终"));
}

// 禁止 marker 再交互
function disableMarkers() {
    markers.forEach(marker => {
        marker.setDraggable(false);
        marker.setCursor("default");
        if (marker._handlers) {
            marker.off("dragend", marker._handlers.handleDragEnd);
            marker.off("rightclick", marker._handlers.handleRightClick);
        }
    });
}

// ========================================================================
// 绘制路径与计算距离
// ========================================================================
function redrawPath() {
    if (line) line.setMap(null);
    distanceTexts.forEach(t => t.setMap(null));
    if (totalText) totalText.setMap(null);
    distanceTexts = [];
    totalText = null;

    if (markers.length < 2) return;

    const path = markers.map(m => m.getPosition());
    line = new AMap.Polyline({
        path,
        strokeColor: "#FF33FF",
        strokeWeight: 4,
        showDir: true,
        map,
    });

    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const dist = AMap.GeometryUtil.distance(path[i], path[i + 1]);
        total += dist;

        const midLng = (path[i].lng + path[i + 1].lng) / 2;
        const midLat = (path[i].lat + path[i + 1].lat) / 2;

        const textMarker = new AMap.Text({
            position: [midLng, midLat],
            text: `${dist.toFixed(1)} m`,
            style: { color: "#333", fontSize: "12px", background: "rgba(255,255,255,0.7)", border: "1px solid #ddd", padding: "2px 4px" },
            anchor: "center",
            map,
        });
        distanceTexts.push(textMarker);
    }

    const last = path[path.length - 1];
    totalText = new AMap.Text({
        position: last,
        text: `总长度：${total.toFixed(1)} m`,
        style: { color: "#007acc", fontSize: "14px", fontWeight: "600", background: "rgba(255,255,255,0.8)", padding: "4px 6px", border: "1px solid #ccc" },
        offset: new AMap.Pixel(10, -30),
        map,
    });
}

// ========================================================================
// 清空规划
// ========================================================================
function clearPlanning() {
    // 清除无人机与飞行轨迹
    if (uavMarker) {
        map.remove(uavMarker);
        uavMarker = null;
    }
    if (passedPolyline) {
        map.remove(passedPolyline);
        passedPolyline = null;
    }
    if (markers.length === 0 && !line && !totalText) {
        ElMessage.info("当前没有内容可清空。");
        return;
    }

    markers.forEach(marker => map.remove(marker));
    markers = [];

    if (line) { map.remove(line); line = null; }
    distanceTexts.forEach(t => map.remove(t));
    distanceTexts = [];

    if (totalText) { map.remove(totalText); totalText = null; }

    localStorage.setItem("planningData", "[]");
    ElMessage.success("规划已清空！");
}

// ========================================================================
// 本地持久化
// ========================================================================
function savePlanningData() {
    const data = markers.map((marker) => {
        const pos = marker.getPosition();
        let type = "经";
        const icon = marker.getIcon()?.getImage?.();
        if (icon?.includes?.("StartPoint")) type = "起";
        else if (icon?.includes?.("EndPoint")) type = "终";
        return { lng: pos.lng, lat: pos.lat, type };
    });

    localStorage.setItem("planningData", JSON.stringify(data || []));
}

function restorePlanningData() {
    const raw = localStorage.getItem("planningData") || "[]";
    const data = JSON.parse(raw);

    if (data.length === 0) {
        console.log("没有保存的规划数据。");
        return;
    }

    data.forEach((item) => {
        const marker = new AMap.Marker({
            position: [item.lng, item.lat],
            draggable: false,
            cursor: "default",
            icon: createTextIcon(item.type),
            anchor: "bottom-center",
        });
        map.add(marker);
        markers.push(marker);
    });

    redrawPath();
    ElMessage.success("已恢复上次规划路径！");
}

// ========================================================================
// 工具函数
// ========================================================================
function createTextIcon(text) {
    let imagePath = MidIcon;
    if (text === "起") imagePath = StartIcon;
    if (text === "终") imagePath = EndIcon;
    return new AMap.Icon({
        size: new AMap.Size(25, 30),
        image: imagePath,
        imageSize: new AMap.Size(25, 30),
    });
}

// ========================================================================
// 无人机飞行：后端驱动 + WebSocket 状态推送
// ========================================================================
async function startFly() {
    if (!map || markers.length < 2) {
        ElMessage.warning("尚未规划路径，无法开始飞行！");
        return;
    }
    if (!speed.value || speed.value <= 0) {
        ElMessage.warning("请设置有效飞行速度");
        return;
    }

    // 清理旧 UAV & 轨迹
    if (uavMarker) {
        map.remove(uavMarker);
        uavMarker = null;
    }
    if (passedPolyline) {
        map.remove(passedPolyline);
        passedPolyline = null;
    }

    // 取路径（AMap 为 [lng,lat]）
    const pathLngLat = markers.map(m => m.getPosition());
    const startPos = pathLngLat[0];

    // 创建 UAV Marker 与已飞行轨迹
    const UAVIcon = new AMap.Icon({ image: uavIcon, imageSize: new AMap.Size(32, 32) });
    uavMarker = new AMap.Marker({
        map,
        position: startPos,
        icon: UAVIcon,
        anchor: "bottom-center",
    });
    passedPolyline = new AMap.Polyline({
        map,
        strokeColor: "#00cc66",
        strokeWeight: 4,
        path: [startPos],
    });
    lastPathLength = 1;

    try {
        // 后端预期为 [lat, lng]
        const pathLatLng = pathLngLat.map(p => [p.lat, p.lng]);
        const res = await axios.post("/v1/drone/path", {
            user_id: userId.value,
            path: pathLatLng,
            speed: speed.value
        });
        console.log(res.data.message);
        if (res.data?.status === "success") {
            ElMessage.success("路径已发送，无人机开始飞行");
            isFlying.value = true;
            isPaused.value = false;
            connectWebSocket();
        } else {
            throw new Error(res.data?.detail || "后端未返回成功状态");
        }
    } catch (err) {
        console.error(err);
        ElMessage.error("发送路径失败");
    }
}

function connectWebSocket() {
    // 关闭旧连接
    if (ws) {
        ws.close();
    }
    ws = new WebSocket("ws://localhost:8000/api/v1/drone/ws");

    ws.onopen = () => {
        ElMessage.success("WebSocket连接成功");
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            uavStatus.value = data;

            const s = data.status;
            isFlying.value = (s === "flying" || s === "paused");
            isPaused.value = (s === "paused");

            // 更新 UAV 位置（后端推送为 lat/lng，AMap 需要 [lng, lat]）
            if (uavMarker) {
                const lnglat = [data.lng, data.lat];
                console.log("uavMarker.setPosition", lnglat);
                uavMarker.setPosition(lnglat);

                // 轨迹追加（可按需抽样）
                if (passedPolyline) {
                    const current = passedPolyline.getPath();
                    current.push(new AMap.LngLat(lnglat[0], lnglat[1]));
                    if (current.length > lastPathLength) {
                        passedPolyline.setPath(current);
                        lastPathLength = current.length;
                    }
                }

                // 跟随视角（可注释掉）
                map.setCenter(lnglat, true);
            }

            // 若后端状态返回 idle/finished，可在此重置按钮状态
            if (s === "idle" || s === "finished") {
                isFlying.value = false;
                isPaused.value = false;
            }
        } catch (e) {
            console.error("WS 数据解析失败", e);
        }
    };

    ws.onclose = (event) => {
        ws = null;
        // 若飞行未主动停止，且连接异常关闭，可以选择尝试重连
    };

    ws.onerror = (e) => {
        console.error("WS 错误", e);
    };
}

async function pauseFly() {
    try {
        const res = await axios.post("/v1/drone/pause");
        if (res.data?.status === "success") {
            isPaused.value = true;
            ElMessage.success("已暂停飞行");
        }
    } catch (e) {
        ElMessage.error("暂停失败");
    }
}

async function resumeFly() {
    try {
        const res = await axios.post("/v1/drone/resume");
        if (res.data?.status === "success") {
            isPaused.value = false;
            ElMessage.success("继续飞行");
        }
    } catch (e) {
        ElMessage.error("继续失败");
    }
}

async function stopFly() {
    try {
        const res = await axios.post("/v1/drone/stop");
        if (res.data?.status === "success") {
            ElMessage.success("终止飞行成功");
        }
    } catch (e) {
        ElMessage.error("终止失败");
    } finally {
        isFlying.value = false;
        isPaused.value = false;
        if (ws) {
            try { ws.close(1000, "user stop"); } catch { }
            ws = null;
        }
    }
}

// 组件卸载时清理 WS
onUnmounted(() => {
    if (ws) {
        try { ws.close(1000, "component unmount"); } catch { }
        ws = null;
    }
});
</script>

<style scoped>
#Container {
    width: 100%;
    height: 100%;
    min-height: 500px;
}

.uav-status {
    border: 1px solid #e5e6eb;
    border-radius: 8px;
    padding: 10px 12px;
    background: #fafafa;
}

.uav-status h3 {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: #333;
}

.uav-params {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
}

.param-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.param-item .label {
    width: 90px;
    color: #666;
    font-size: 13px;
}
</style>