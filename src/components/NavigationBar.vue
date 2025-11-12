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
                <CircleClose />
            </el-icon>
            <span>退出</span>
        </el-menu-item>
    </el-menu>

    <!--退出确认弹窗 -->
    <el-dialog v-model="logoutDialogVisible" title="确认退出" width="320px" align-center>
        <span>确定要退出当前账号吗？</span>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="logoutDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="confirmLogout">确认</el-button>
            </span>
        </template>
    </el-dialog>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import {
    Picture as IconPicture,
    Menu as IconMenu,
    List,
    CircleClose,
    HomeFilled,
    View as IconView,
} from "@element-plus/icons-vue";

const activeIndex = ref("1");
const store = useStore();
const router = useRouter();

// 控制退出确认弹窗显示
const logoutDialogVisible = ref(false);

// 菜单点击事件
const handleSelect = (key: string, keyPath: string[]) => {
    switch (key) {
        case "1":
            router.push("/");
            break;

        case "2-1":
            router.push("/flightRecord");
            break;

        case "2-2":
            router.push("/photoAlbum");
            break;

        case "3-1":
            store.commit("setMapStyle", "normal");
            break;
        case "3-2":
            store.commit("setMapStyle", "satellite");
            break;

        case "4":
            logoutDialogVisible.value = true;
            break;
    }
};

//确认退出函数
const confirmLogout = () => {
    logoutDialogVisible.value = false;
    localStorage.removeItem("userID");
    router.push("/login");
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

.el-menu-item.is-active {
    color: #007acc !important;
    border-bottom: 2px solid #007acc;
    background-color: transparent !important;
    font-weight: 600;
}

.el-icon {
    margin-right: 6px;
    font-size: 16px;
    vertical-align: middle;
    color: inherit;
}

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
