<template>
    <el-card class="photo-card" shadow="hover">
        <el-image :src="photo.frame_preview" fit="cover" lazy class="photo-img"
            :preview-src-list="[photo.frame_preview]" @show="disableScroll" @close="enableScroll" />

        <div class="photo-info">
            <div class="row">
                <span class="label">ID：</span>
                <span class="value">{{ photo.image_id }}</span>
            </div>
            <div class="row">
                <span class="label">时间：</span>
                <span class="value">{{ photo.capture_time }}</span>
            </div>
            <div class="row">
                <span class="label">描述：</span>
                <span class="value" :title="photo.desc">{{ photo.desc || '（无）' }}</span>
            </div>
        </div>

        <div class="actions">
            <!-- 下载 -->
            <el-tooltip content="下载" placement="top">
                <el-button type="primary" :icon="Download" circle @click="handleDownload" />
            </el-tooltip>

            <!-- 分析 -->
            <el-tooltip content="分析" placement="top">
                <el-button type="primary" :icon="Service" circle @click="analyzeImage" />
            </el-tooltip>

            <!-- 修改描述 -->
            <el-tooltip content="修改描述" placement="top">
                <el-button type="primary" :icon="Edit" circle @click="handleEditDesc" />
            </el-tooltip>

            <!-- 删除 -->
            <el-tooltip content="删除" placement="top">
                <el-button type="danger" :icon="Delete" circle @click="handleDelete" />
            </el-tooltip>
        </div>
    </el-card>
</template>

<script setup>
import { defineProps, defineEmits } from "vue";
import { ElMessageBox } from "element-plus";
import { Delete, Edit, Download, Service } from "@element-plus/icons-vue";

const disableScroll = () => {
    document.body.style.overflow = "hidden";
    const wrap = document.querySelector(".el-scrollbar__wrap");
    if (wrap) wrap.style.overflow = "hidden";
};

const enableScroll = () => {
    document.body.style.overflow = "";
    const wrap = document.querySelector(".el-scrollbar__wrap");
    if (wrap) wrap.style.overflow = "auto";
};

const props = defineProps({
    photo: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits(["delete", "download", "edit", "analyze"]);

const handleDelete = () => {
    ElMessageBox.confirm("确定要删除这张照片吗？", "提示", {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning",
    })
        .then(() => emit("delete", props.photo.image_id))
        .catch(() => { });
};

const handleDownload = () => {
    emit("download", props.photo.image_id);
};


const analyzeImage = () => {
    emit("analyze", props.photo.image_id);
};

const handleEditDesc = async () => {
    try {
        const { value } = await ElMessageBox.prompt("请输入新的描述", "修改描述", {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            inputValue: props.photo.desc || "",
            inputType: "textarea",
            inputPlaceholder: "请输入图片描述",
            inputStyle: "min-height: 260px; max-height: 360px; white-space: pre-wrap;",
            draggable: true
        });


        emit("edit", { image_id: props.photo.image_id, newDesc: value || "" });

    } catch { }
};

</script>

<style scoped>
.photo-card {
    background-color: #fff;
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    overflow: hidden;
    transition: transform 0.2s ease;
}

.photo-card:hover {
    transform: translateY(-4px);
}

.photo-img {
    width: 100%;
    height: 280px;
    border-radius: 8px;
    object-fit: cover;
}

.photo-info {
    margin-top: 8px;
    font-size: 13px;
    color: #555;
}

.row {
    display: flex;
    line-height: 20px;
    margin: 2px 0;
}

.label {
    color: #888;
    width: 44px;
    flex: 0 0 44px;
}

.value {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.actions {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}
</style>
