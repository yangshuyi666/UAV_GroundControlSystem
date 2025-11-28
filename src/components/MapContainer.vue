<template>
    <el-row>
        <el-col :span="16">
            <div id="Container"></div>
        </el-col>

        <el-col :span="8" class="control-panel">
            <Camera />

            <!-- 无人机状态面板 -->
            <div class="uav-status">
                <h3>无人机状态（用户ID：{{ userId }}）</h3>

                <div v-if="uavStatus">
                    <div>经纬度：（{{ (uavStatus.lat ?? 0).toFixed(6) }}, {{ (uavStatus.lng ?? 0).toFixed(6) }}）</div>
                    <div>高度：{{ uavStatus.altitude.toFixed(2) ?? '—' }} m</div>
                    <div>速度：{{ uavStatus.speed ?? '—' }} km/h</div>
                    <div>方向角：{{ uavStatus.pitch.toFixed(2) ?? '—' }} °</div>

                    <!-- 电量显示 -->
                    <div>
                        电量：
                        <b :style="{
                            color:
                                uavStatus.battery < 30
                                    ? '#ff4d4f'
                                    : '#52c41a',
                        }">
                            {{ uavStatus.battery.toFixed(2) ?? '—' }}%
                        </b>
                    </div>

                    <div>
                        状态：
                        <b :style="{
                            color:
                                uavStatus.status === 'flying'
                                    ? '#1677ff'
                                    : uavStatus.status === 'paused'
                                        ? '#fa8c16'
                                        : '#666',
                        }">
                            {{ uavStatus.status || '—' }}
                        </b>
                    </div>
                    <div>时间：{{ uavStatus.timestamp || '—' }}</div>
                    <!-- 方向指针 -->
                    <Compass :pitch="uavStatus.pitch" />
                </div>
                <div v-else>等待连接或飞行未开始</div>
            </div>

            <!-- 飞行参数滑块 -->
            <div class="uav-params card-section">
                <div class="param-item">
                    <span class="label">速度 (km/h，仅自动模式下设置有效)</span>
                    <el-slider v-model="speed" :min="10" :max="100" :step="5" show-input input-size="small"
                        @change="handleSpeedChange" />
                </div>
            </div>

            <!-- 控制按钮 -->
            <div class="control-buttons card-section">

                <el-row :gutter="10">
                    <el-col :span="8">
                        <el-button id="PlanStart" type="primary" plain block
                            :disabled="store.state.isPlanning || isFlying" @click="startPlanning">
                            开始规划
                        </el-button>
                    </el-col>
                    <el-col :span="8">
                        <el-button id="PlanClear" type="warning" plain block
                            :disabled="store.state.isPlanning || isFlying" @click="clearPlanning">
                            清空规划
                        </el-button>
                    </el-col>
                    <el-col :span="8">
                        <el-button id="StartFly" type="success" block @click="startFly"
                            :disabled="store.state.isPlanning || isFlying">
                            开始飞行
                        </el-button>
                    </el-col>

                    <el-col :span="8">
                        <el-button id="PauseFly" type="info" block @click="pauseFly" :disabled="!isFlying || isPaused">
                            暂停
                        </el-button>
                    </el-col>
                    <el-col :span="8">
                        <el-button id="ResumeFly" type="primary" block @click="resumeFly"
                            :disabled="!isFlying || !isPaused">
                            继续
                        </el-button>
                    </el-col>
                    <el-col :span="8">
                        <el-button id="StopFly" type="danger" block @click="stopFly" :disabled="!isFlying">
                            终止
                        </el-button>
                    </el-col>
                </el-row>
            </div>
        </el-col>
    </el-row>
    <el-row class="joystick-row">
        <el-col :span="12">
            <div id="left_joystick" :class="{ 'joystick-disabled': isFlying }"></div>
        </el-col>
        <el-col :span="12">
            <div id="right_joystick" :class="{ 'joystick-disabled': isFlying }"></div>
        </el-col>
    </el-row>
</template>

<script setup>
import { onMounted, ref, watch, onUnmounted } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import axios from "@/api/request";
import Camera from "@/components/Camera.vue";
import nipplejs from "nipplejs";
import Compass from "@/components/Compass.vue";
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
const userId = ref(Number(localStorage.getItem("userID")) || 3);
const speed = ref(10);


// ========== 初始化地图 ==========
onMounted(() => {
    if (!window.AMap) {
        console.error("AMap SDK 未加载");
        return;
    }

    map = new AMap.Map("Container", {
        center: [118.790784, 31.937422],
        zoom: 17,
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
    getStatus();

    // 左摇杆：用于控制无人机上升下降、旋转
    const left = nipplejs.create({
        zone: document.getElementById("left_joystick"),
        mode: "static",
        position: { left: "50%", top: "50%" },
        color: "gray",
    });

    // 高度控制相关变量
    let altitudeControlTimer = null;
    let currentRate = 0;
    const MAX_RATE = 0.2; // 最大高度变化速率（米/秒）

    // 方向角控制相关变量
    let pitchControlTimer = null;
    let currentPitchDelta = 0;
    const MAX_PITCH_DELTA = 0.1; // 最大方向角变化量（度/每次调整）

    left.on("move", (evt, data) => {
        // 检查摇杆方向
        if (data.direction) {
            // 上下方向控制高度
            if (data.direction.angle === "up" || data.direction.angle === "down") {
                const force = data.force; // 摇杆力度 0-1
                // 计算高度变化速率
                currentRate = data.direction.angle === "up"
                    ? MAX_RATE * force
                    : -MAX_RATE * force;

                // 启动或保持高度控制定时器
                if (!altitudeControlTimer) {
                    controlAltitudeRate(currentRate);
                    altitudeControlTimer = setInterval(() => {
                        controlAltitudeRate(currentRate);
                    }, 100); // 每100ms发送一次指令
                }

                // 停止方向角控制（如果正在运行）
                stopPitchControl();
            }
            // 左右方向控制旋转（方向角）
            else if (data.direction.angle === "left" || data.direction.angle === "right") {
                const force = data.force; // 摇杆力度 0-1
                // 计算方向角变化量（右为正，左为负）
                currentPitchDelta = data.direction.angle === "right"
                    ? MAX_PITCH_DELTA * force
                    : -MAX_PITCH_DELTA * force;

                // 启动或保持方向角控制定时器
                if (!pitchControlTimer) {
                    controlPitch(currentPitchDelta);
                    pitchControlTimer = setInterval(() => {
                        controlPitch(currentPitchDelta);
                    }, 100); // 每100ms发送一次指令
                }

                // 停止高度控制（如果正在运行）
                stopAltitudeControl();
            }
        } else {
            // 不在有效方向时，停止所有控制
            stopAltitudeControl();
            stopPitchControl();
        }
    });

    left.on("end", () => {
        // 摇杆释放时，停止所有控制
        stopAltitudeControl();
        stopPitchControl();
    });

    /**
     * 停止高度控制
     */
    function stopAltitudeControl() {
        if (altitudeControlTimer) {
            clearInterval(altitudeControlTimer);
            altitudeControlTimer = null;
            currentRate = 0;
            controlAltitudeRate(0);
        }
    }

    /**
     * 停止方向角控制
     */
    function stopPitchControl() {
        if (pitchControlTimer) {
            clearInterval(pitchControlTimer);
            pitchControlTimer = null;
            currentPitchDelta = 0;
            controlPitch(0);
        }
    }

    /**
     * 控制无人机高度变化率
     */
    const controlAltitudeRate = async (rate) => {
        try {
            const res = await axios.post("/v1/drone/altitude", null, {
                params: { rate: rate }
            });

            if (res.data?.success) {
                // console.log(`高度控制指令发送成功: ${rate.toFixed(2)}米/秒`);
            } else {
                console.error(`高度控制失败: ${res.data?.message}`);
            }
        } catch (err) {
            console.error("高度控制请求失败", err);
        }
    };

    /**
     * 控制无人机方向角变化
     */
    const controlPitch = async (delta) => {
        try {
            const res = await axios.post("/v1/drone/pitch", null, {
                params: { delta: delta }
            });

            if (res.data?.success) {
                // console.log(`方向角控制指令发送成功: ${delta.toFixed(2)}度`);
            } else {
                console.error(`方向角控制失败: ${res.data?.message}`);
            }
        } catch (err) {
            console.error("方向角控制请求失败", err);
        }
    };

    // 右摇杆：支持实时切换方向
    const right = nipplejs.create({
        zone: document.getElementById("right_joystick"),
        mode: "static",
        position: { left: "50%", top: "50%" },
        color: "gray",
    });

    // 移动控制定时器（仅用于存储当前定时器ID）
    let moveControlTimer = null;
    // 心跳检测相关：记录最后一次发送指令的时间戳、心跳定时器ID
    let lastMoveTimestamp = 0;
    let heartbeatTimer = null;
    const MOVE_TIMEOUT = 300;

    // 存储最新的方向和力度（供定时器使用）
    let currentDirection = "";
    let currentForce = 0;

    // 发送移动指令（新增：处理返回的状态，更新界面）
    const controlMove = async () => {
        try {
            const res = await axios.post("/v1/drone/move", null, {
                params: {
                    direction: currentDirection,
                    force: currentForce
                }
            });
            if (res.data?.success) {
                // 关键：从返回结果中获取状态，更新界面（比如速度、电量显示）
                const { speed, remaining_battery, is_flying } = res.data;
                console.log(`状态更新：速度=${speed}m/s，电量=${remaining_battery}%，飞行中=${is_flying}`);
                // 这里可以添加界面更新逻辑，比如：
                // document.getElementById("drone-speed").textContent = speed;
                // document.getElementById("drone-battery").textContent = remaining_battery;
            } else {
                console.error(`移动失败：${res.data?.message}`);
                // 失败时也强制停止（比如电量耗尽）
                if (res.data?.message.includes("电量耗尽")) {
                    stopMoveControl();
                }
            }
            lastMoveTimestamp = Date.now();
        } catch (err) {
            console.error("移动请求失败：", err);
        }
    };

    // 停止移动（彻底清理定时器，避免残留）
    function stopMoveControl() {
        // 1. 清除移动定时器（关键：避免残留定时器继续发送指令）
        if (moveControlTimer) {
            clearInterval(moveControlTimer);
            moveControlTimer = null; // 置空，确保下次能重新创建
        }
        // 2. 清除心跳定时器
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null; // 置空
        }
        // 3. 强制设置停止状态并发送指令
        currentDirection = "";
        currentForce = 0;
        console.log("发送停止移动指令");
        controlMove();
    }

    // 心跳检测函数：定期检查是否超时，超时则强制停止
    function checkMoveTimeout() {
        const now = Date.now();
        const timeDiff = now - lastMoveTimestamp;
        if (timeDiff > MOVE_TIMEOUT && currentForce > 0) {
            console.log(`移动超时（${timeDiff}ms），强制停止`);
            stopMoveControl();
        }
    }

    // 摇杆移动事件（修复：确保定时器能重新创建）
    right.on("move", (evt, data) => {
        if (data.direction) {
            // 更新最新方向和力度
            const rawForce = data.force || 0;
            currentForce = Math.max(0, Math.min(1, rawForce));

            switch (data.direction.angle) {
                case "up": currentDirection = "forward"; break;
                case "down": currentDirection = "backward"; break;
                case "left": currentDirection = "left"; break;
                case "right": currentDirection = "right"; break;
                default:
                    stopMoveControl();
                    return;
            }

            // 关键：无论之前是否有定时器，先清除再创建（避免残留）
            if (moveControlTimer) {
                clearInterval(moveControlTimer);
            }
            moveControlTimer = setInterval(controlMove, 100);

            // 启动心跳定时器
            if (!heartbeatTimer) {
                heartbeatTimer = setInterval(checkMoveTimeout, 50);
            }

            lastMoveTimestamp = Date.now();
        } else {
            stopMoveControl();
        }
    });

    // 覆盖所有停止场景
    right.on("end", () => stopMoveControl());
    right.on("cancel", () => stopMoveControl());
    right.on("destroy", () => stopMoveControl());
    right.on("remove", () => stopMoveControl());

    // 浏览器焦点和页面卸载兜底
    window.addEventListener("blur", () => {
        if (currentForce > 0) {
            stopMoveControl();
        }
    });
    window.addEventListener("beforeunload", () => {
        stopMoveControl();
    });

    restorePlanningData();
});



window.addEventListener("beforeunload", (event) => {
    // 判断是关闭标签页（或浏览器）而不是刷新
    if (performance.getEntriesByType("navigation")[0].type !== "reload") {
        localStorage.removeItem("planningData");
        localStorage.removeItem("userID");
    }
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

// 速度变化处理函数
const handleSpeedChange = async (newSpeed) => {
    try {
        // 调用后端速度更新接口
        const res = await axios.post("/v1/drone/speed", null, {
            params: {
                speed: newSpeed
            }
        });

        if (res.data?.success) {

        } else {
            ElMessage.error(`更新速度失败: ${res.data?.message || '未知错误'}`);
            // 恢复到之前的有效值
            speed.value = speed.value;
        }
    } catch (err) {
        ElMessage.error("网络错误，无法更新速度");
        // 恢复到之前的有效值
        speed.value = speed.value;
    }
};

// ========================================================================
// 规划模式控制
// ========================================================================
function startPlanning() {
    if (isFlying.value) {
        ElMessage.warning("飞行进行中，无法开始规划！");
        return;
    }

    // 清除飞行轨迹
    // if (uavMarker) {
    //     map.remove(uavMarker);
    //     uavMarker = null;
    // }
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
    // 清除飞行轨迹
    // if (uavMarker) {
    //     map.remove(uavMarker);
    //     uavMarker = null;
    // }
    if (passedPolyline) {
        map.remove(passedPolyline);
        passedPolyline = null;
    }
    if (markers.length === 0 && !line && !totalText) {
        // ElMessage.info("当前没有内容可清空。");
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
    // if (uavMarker) {
    //     map.remove(uavMarker);
    //     uavMarker = null;
    // }
    if (passedPolyline) {
        map.remove(passedPolyline);
        passedPolyline = null;
    }

    // 取路径（AMap 为 [lng,lat]）
    const pathLngLat = markers.map(m => m.getPosition());
    const startPos = pathLngLat[0];

    // 创建 UAV Marker 与已飞行轨迹
    // uavMarker = new AMap.Marker({
    //     map,
    //     position: startPos,
    //     icon: new AMap.Icon({ image: uavIcon, imageSize: new AMap.Size(32, 32) }),
    //     anchor: "bottom-center",
    // });
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

        if (res.data?.success) {
            ElMessage.success("路径已发送，无人机开始飞行");
            isFlying.value = true;
            isPaused.value = false;
            connectWebSocket();
        } else {
            throw new Error(res.data?.success || "后端未返回成功状态");
        }
    } catch (err) {
        console.error(err);
        ElMessage.error("发送路径失败");
    }
}
async function getStatus() {
    const res = await axios.get("/v1/drone/status");
    if (res.data?.success) {
        // 建立websocket长连接
        connectWebSocket();
    } else {
        ElMessage.error("请检查后端服务");
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
                // console.log("uavMarker.setPosition", lnglat);
                uavMarker.setPosition(lnglat);

                // 轨迹追加
                if (passedPolyline) {
                    const current = passedPolyline.getPath();
                    current.push(new AMap.LngLat(lnglat[0], lnglat[1]));
                    if (current.length > lastPathLength) {
                        passedPolyline.setPath(current);
                        lastPathLength = current.length;
                    }
                }

                // 跟随视角
                map.setCenter(lnglat, true);
            }
            else {
                uavMarker = new AMap.Marker({
                    map,
                    position: [data.lng, data.lat],
                    icon: new AMap.Icon({ image: uavIcon, imageSize: new AMap.Size(32, 32) }),
                    anchor: "bottom-center",
                });
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
        if (res.data?.success) {
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
        if (res.data?.success) {
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
        if (res.data?.success) {
            isPaused.value = false;
            ElMessage.success("终止飞行成功");
            // if (uavMarker) {
            //     map.remove(uavMarker);
            // }
            clearPlanning();
        }
    } catch (e) {
        ElMessage.error("终止失败");
    } finally {
        isFlying.value = false;
        isPaused.value = false;
        // if (ws) {
        //     try { ws.close(1000, "user stop"); } catch { }
        //     ws = null;
        // }
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

.joystick-row {
    height: 140px;
    /* 限制整体高度 */
    background: #f7f9fc;
    border-top: 1px solid #e5e6eb;
    display: flex;
    align-items: center;
}

/* 左右两个摇杆区样式 */
#left_joystick,
#right_joystick {
    width: 200px;
    height: 120px;
    margin: auto;
    position: relative;
}

.joystick-disabled {
    pointer-events: none;
    /* 禁止鼠标和触控事件 */
    opacity: 0.5;
    /* 半透明表现为“禁用状态” */
    filter: grayscale(70%);
}

/* 右侧控制面板 */
.control-panel {
    padding: 10px 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    background: #f8f9fb;
    border-left: 1px solid #eee;
    max-height: 800px;
    overflow-y: auto;
}

/* 状态面板样式 */
.uav-status {
    border: 1px solid #e5e6eb;
    border-radius: 10px;
    padding: 10px 12px;
    background: linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.uav-status h3 {
    margin: 0 0 8px 0;
    font-size: 15px;
    font-weight: 600;
    color: #333;
}

.uav-status div {
    font-size: 13px;
    color: #444;
    margin-bottom: 4px;
}

/* 卡片式小节 */
.card-section {
    border: 1px solid #e5e6eb;
    border-radius: 10px;
    background: #fff;
    padding: 12px 16px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.card-section h4 {
    margin-bottom: 10px;
    font-size: 14px;
    font-weight: 600;
    color: #333;
}

/* 飞行参数滑块 */
.uav-params {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.param-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.param-item .label {
    color: #666;
    font-size: 13px;
}

/* 控制按钮区 */
.control-buttons .el-button {
    width: 100%;
    border-radius: 8px;
    font-weight: 500;
}

.control-buttons .el-row {
    row-gap: 10px;
}
</style>