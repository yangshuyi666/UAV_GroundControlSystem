<template>
    <div class="not-found">
        <div class="content-box">
            <img src="@/assets/UAV.svg" class="logo" alt="UAV logo" />
            <h1 class="title">404 - 页面未找到</h1>
            <p class="description">
                抱歉，您访问的页面不存在或已被移动。
                <br />
                请检查输入的地址或返回主界面。
            </p>
            <el-button type="primary" size="large" @click="goHome">
                <el-icon>
                    <HomeFilled />
                </el-icon>
                返回首页
            </el-button>
        </div>
    </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { HomeFilled } from "@element-plus/icons-vue";

const router = useRouter();

const goHome = () => {
    router.push("/");
};
</script>

<style scoped>
/* ============================= */
/*         页面整体布局样式        */
/* ============================= */
.not-found {
    width: 100%;
    height: 100vh;
    background: #f8fafc;
    /* 干净浅灰色背景 */
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    color: #333;
    font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
}

/* ============================= */
/*         内容盒子样式           */
/* ============================= */
.content-box {
    padding: 40px 60px;
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    max-width: 500px;
}

/* ============================= */
/*         UAV Logo 样式          */
/* ============================= */
.logo {
    width: 64px;
    height: 64px;
    object-fit: contain;
    margin-bottom: 20px;
    opacity: 0.9;
}

/* ============================= */
/*         标题与文字样式         */
/* ============================= */
.title {
    font-size: 24px;
    font-weight: 600;
    color: #007acc;
    margin-bottom: 12px;
}

.description {
    color: #666;
    font-size: 14px;
    margin-bottom: 24px;
    line-height: 1.6;
}

/* ============================= */
/*         按钮样式优化           */
/* ============================= */
.el-button {
    background-color: #007acc;
    border: none;
    transition: all 0.2s;
}

.el-button:hover {
    background-color: #0096e6;
}
</style>