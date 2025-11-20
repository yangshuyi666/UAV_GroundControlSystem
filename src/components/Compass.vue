<template>
    <div class="compass-container">
        <img src="@/assets/Compass.png" class="compass-image" :style="{ transform: `rotate(${displayAngle}deg)` }" />
    </div>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
    pitch: { type: Number, default: 0 },
});

// 当前用于显示的角度（带过渡）
const displayAngle = ref(0);

watch(
    () => props.pitch,
    (newAngle) => {
        let current = displayAngle.value;

        // 计算差值
        let diff = newAngle - current;

        // 如果差值大于 180°，说明从另一侧转更近
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        // 更新显示角度
        displayAngle.value = current + diff;
    }
);
</script>

<style scoped>
.compass-container {
    width: 70px;
    height: 70px;
    margin: 8px auto;
    display: flex;
    justify-content: center;
    align-items: center;
}

.compass-image {
    width: 100%;
    height: 100%;
    transition: transform 0.1s linear;
}
</style>
