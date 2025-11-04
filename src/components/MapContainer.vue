<template>
    <el-row>
        <el-col :span="16">
            <div id="Container"></div>
        </el-col>

        <el-col :span="8" style="padding: 20px; display: flex; flex-direction: column; gap: 10px;">
            <el-button id="PlanStart" type="primary" :disabled="store.state.isPlanning || isFlying"
                @click="startPlanning">
                开始规划
            </el-button>

            <el-button id="PlanClear" type="warning" @click="clearPlanning"
                :disabled="store.state.isPlanning || isFlying">
                清空规划
            </el-button>

            <el-button id="StartFly" type="success" @click="startFly" :disabled="store.state.isPlanning">
                开始飞行
            </el-button>

            <el-button id="PauseFly" type="info" @click="pauseFly" :disabled="!isFlying">
                暂停飞行
            </el-button>

            <el-button id="ResumeFly" type="primary" @click="resumeFly" :disabled="!isPaused">
                继续飞行
            </el-button>

        </el-col>
    </el-row>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";

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
    setTimeout(restorePlanningData, 500)
});

// ========== 图层样式监听 ==========
watch(() => store.state.mapStyle, (newStyle) => updateMapStyle(newStyle));

function updateMapStyle(style) {
    if (!map || !AMap) return;
    if (!satelliteLayer) satelliteLayer = new AMap.TileLayer.Satellite();
    if (style === "satellite") {
        if (!map.hasLayer(satelliteLayer)) map.add(satelliteLayer);
    } else {
        if (map.hasLayer(satelliteLayer)) map.remove(satelliteLayer);
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

    // 🧹 清除无人机与飞行轨迹
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

    // 若已有路径，则让节点可编辑
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
// 🟡 节点操作逻辑
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
// 🔵 绘制路径与计算距离
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
// 🧹 清空规划
// ========================================================================
function clearPlanning() {
    // 🧹 清除无人机与飞行轨迹
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
// 💾 本地持久化
// ========================================================================
function savePlanningData() {
    const data = markers.map((marker) => {
        const pos = marker.getPosition();
        let type = "经";
        const icon = marker.getIcon()?.getImage();
        if (icon?.includes("StartPoint")) type = "起";
        else if (icon?.includes("EndPoint")) type = "终";
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
// ✈️ 无人机飞行控制
// ========================================================================

let uavMarker = null;          // 无人机Marker
let passedPolyline = null;     // 已飞行过路径
let isFlying = ref(false);
let isPaused = ref(false);

function startFly() {
    if (!map || markers.length < 2) {
        ElMessage.warning("尚未规划路径，无法开始飞行！");
        return;
    }

    // 若已有无人机 marker，清理旧状态
    if (uavMarker) {
        map.remove(uavMarker);
        uavMarker = null;
    }
    if (passedPolyline) {
        map.remove(passedPolyline);
        passedPolyline = null;
    }

    const path = markers.map(m => m.getPosition());

    const UAVIcon = new AMap.Icon({
        image: uavIcon,
        imageSize: new AMap.Size(32, 32),
    });

    // 创建无人机 marker
    uavMarker = new AMap.Marker({
        map,
        position: path[0],
        icon: UAVIcon,
        anchor: "bottom-center",
    });

    // 经过路径线
    passedPolyline = new AMap.Polyline({
        map,
        strokeColor: "#00cc66",
        strokeWeight: 4,
    });

    // 保证动画功能插件加载
    AMap.plugin("AMap.MoveAnimation", () => {
        isFlying.value = true;
        isPaused.value = false;

        uavMarker.on("moving", (e) => {
            passedPolyline.setPath(e.passedPath);
            // 视角跟随
            map.setCenter(e.target.getPosition(), true);

        });
        // map.setFitView(line);
        uavMarker.moveAlong(path, {
            duration: 5000 * path.length,  // 每段500ms，可调整
            autoRotation: true,
        });

        // 自动停止事件
        uavMarker.on("moveend", () => {
            const current = uavMarker.getPosition();
            const last = path[path.length - 1];

            // 仅当到达最后一个点时才重置状态
            if (
                Math.abs(current.lng - last.lng) < 1e-6 &&
                Math.abs(current.lat - last.lat) < 1e-6
            ) {
                isFlying.value = false;
                isPaused.value = false;
            }
        });
    });
}

function pauseFly() {
    if (!uavMarker || !isFlying.value) return;
    uavMarker.pauseMove();
    isPaused.value = true;
    ElMessage.info("已暂停飞行。");
    console.log(uavMarker.getPosition());
}

function resumeFly() {
    if (!uavMarker || !isPaused.value) return;
    uavMarker.resumeMove();
    isPaused.value = false;
    ElMessage.success("继续飞行。");
}

</script>

<style scoped>
#Container {
    width: 100%;
    height: 100%;
    min-height: 500px;
}
</style>