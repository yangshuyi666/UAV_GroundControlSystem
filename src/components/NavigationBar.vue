<template>
    <el-menu :default-active="activeIndex" class="el-menu-demo nav-menu" mode="horizontal" :ellipsis="false"
        @select="handleSelect">
        <el-menu-item index="0" class="logo-item">
            <img id="Nav-logo" src="@/assets/UAV.svg" alt="UAV logo" />
            <span class="title">无人机地面站</span>
        </el-menu-item>

        <el-menu-item index="1">
            <el-icon>
                <HomeFilled />
            </el-icon>
            <span>首页</span>
        </el-menu-item>

        <el-sub-menu index="2">
            <template #title>
                <el-icon>
                    <IconMenu />
                </el-icon>
                <span>数据库</span>
            </template>
            <el-menu-item index="2-1">
                <el-icon>
                    <List />
                </el-icon>
                <span>飞行历程</span>
            </el-menu-item>
            <el-menu-item index="2-2">
                <el-icon>
                    <IconPicture />
                </el-icon>
                <span>相册</span>
            </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="3">
            <template #title>
                <el-icon>
                    <IconView />
                </el-icon>
                <span>地图模式</span>
            </template>
            <el-menu-item index="3-1">
                <span>标准模式</span>
            </el-menu-item>
            <el-menu-item index="3-2">
                <span>卫星模式</span>
            </el-menu-item>
        </el-sub-menu>

        <el-menu-item index="4">
            <el-icon>
                <Setting />
            </el-icon>
            <span>设置</span>
        </el-menu-item>
    </el-menu>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import {
    Picture as IconPicture,
    Menu as IconMenu,
    List,
    Setting,
    HomeFilled,
    View as IconView
} from "@element-plus/icons-vue";

const activeIndex = ref("1");

// 引入 store 和 router
const store = useStore();
const router = useRouter();

// 处理菜单选择事件
const handleSelect = (key: string, keyPath: string[]) => {
    switch (key) {
        // ----- 顶部一级菜单 -----
        case "1":
            router.push("/"); // 首页
            break;
        case "4":
            router.push("/settings"); // 设置
            break;

        // ----- 数据库子菜单 -----
        case "2-1":
            router.push("/flightRecord");
            break;
        case "2-2":
            router.push("/photoAlbum");
            break;

        // ----- 地图模式：更新 store -----
        case "3-1": // 标准模式
            store.commit("setMapStyle", "normal");
            break;
        case "3-2": // 卫星模式
            store.commit("setMapStyle", "satellite");
            break;

        default:
            break;
    }
};
</script>

<style scoped>
/* =================== */
/*   导航栏整体样式     */
/* =================== */
.nav-menu {
    background-color: #ffffff;
    border-bottom: 1px solid #e4e7ed;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    padding: 0 40px;
    height: 56px;
    display: flex;
    align-items: center;
    font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
}

/* =================== */
/*   Logo与标题         */
/* =================== */
.logo-item {
    margin-right: auto !important;
    display: flex;
    align-items: center;
    gap: 10px;
}

#Nav-logo {
    height: 26px;
    width: 26px;
    object-fit: contain;
}

.title {
    font-size: 16px;
    font-weight: 600;
    color: #007acc;
}

/* =================== */
/*   菜单文字样式       */
/* =================== */
.el-menu-item,
.el-sub-menu__title {
    font-size: 14px;
    font-weight: 500;
    color: #333;
    transition: all 0.2s;
    padding: 0 18px;
}

.el-menu-item:hover,
.el-sub-menu__title:hover {
    background-color: transparent;
    color: #007acc;
}

/* 选中项（下划线高亮） */
.el-menu-item.is-active {
    color: #007acc !important;
    border-bottom: 2px solid #007acc;
    background-color: transparent !important;
    font-weight: 600;
}

/* =================== */
/*   图标大小与间距     */
/* =================== */
.el-icon {
    margin-right: 6px;
    font-size: 16px;
    vertical-align: middle;
    color: inherit;
}

/* =================== */
/*   子菜单样式         */
/* =================== */
.el-menu--popup {
    background-color: #ffffff !important;
    border: 1px solid #e4e7ed;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.el-menu--popup .el-menu-item:hover {
    background-color: #f0f7ff !important;
    color: #007acc !important;
}


.el-menu--horizontal>.el-menu-item:nth-child(1) {
    margin-right: auto;
}

.el-menu-item,
.el-sub-menu__title {
    border-radius: 4px;
}
</style>