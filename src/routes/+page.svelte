<script lang="ts">
    import { Canvas, T, useThrelte } from "@threlte/core";
    import Scene from "../components/Scene.svelte";
    import {
        deleteJar,
        downloadAndCacheJar,
        jars,
        jarStatus,
        loadJarList,
        uploadJar,
    } from "../lib/jarStore";
    import { Gizmo, OrbitControls } from "@threlte/extras";
    import { blockAnimations } from "$lib/blockRenderer";
    import {
        deserializeStructure,
        type BuildingData,
    } from "$lib/buildingGadgets";
    import { type Block } from "$lib/types";

    let fileInput: HTMLInputElement;
    let blocks = $state<Block[]>([]);
    let buildDataInput = $state("");
    let valid = $state(false);

    $effect(() => {
        try {
            blocks = [];
            blocks = deserializeStructure(JSON.parse(buildDataInput));
        } catch (error) {
            //console.error(error);
        }
    });

    $effect(() => {
        valid = blocks.length > 0;
    });

    $effect(() => {
        loadJarList();
    });

    async function handleDownload() {
        if ($jarStatus === "downloading") return;

        await downloadAndCacheJar(
            "https://piston-data.mojang.com/v1/objects/a7e5a6024bfd3cd614625aa05629adf760020304/client.jar",
            "Minecraft 1.21.4",
        );
    }

    async function handleFileUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        const file = input.files[0];
        await uploadJar(file);
        input.value = "";
    }

    async function handleDeleteJar(jarId: string) {
        await deleteJar(jarId);
    }
</script>

<div class="relative w-full h-full">
    <Canvas>
        <T.PerspectiveCamera
            makeDefault
            position={[3, 3, 3]}
            fov={60}
            near={0.1}
            far={1000}
        >
            <OrbitControls
                enableDamping
                dampingFactor={0.05}
                enableZoom
                enablePan
                target={[1, -1, -1]}
            >
                <Gizmo />
            </OrbitControls>
        </T.PerspectiveCamera>
        <Scene {blocks} />
    </Canvas>
    <div class="absolute top-4 right-4 z-10 flex flex-col items-end space-y-4">
        <!-- Upload Button -->
        <input
            type="file"
            accept=".jar"
            class="hidden"
            bind:this={fileInput}
            onchange={handleFileUpload}
        />
        <button
            onclick={() => fileInput.click()}
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-lg transition-colors"
        >
            Upload Mod Jar
        </button>

        <!-- Download Official Button -->
        <button
            onclick={handleDownload}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            disabled={$jarStatus === "downloading"}
        >
            {#if $jarStatus === "downloading"}
                Downloading...
            {:else}
                Download Official 1.21.4
            {/if}
        </button>

        <!-- Jar List -->
        <div class="w-80 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4">
            <h2 class="text-lg font-semibold mb-2">Loaded Jars</h2>
            {#if $jars.length === 0}
                <p class="text-gray-500 text-sm">No jar files available</p>
            {:else}
                <div class="space-y-2">
                    {#each $jars as jar}
                        <div
                            class="flex items-center justify-between p-2 bg-white/50 rounded-lg"
                        >
                            <div class="flex-1">
                                <div class="text-sm font-medium">
                                    {jar.name}
                                </div>
                                <div class="text-xs text-gray-500">
                                    {jar.textureCount} textures
                                </div>
                            </div>
                            <button
                                aria-label="Delete Jar"
                                onclick={() => handleDeleteJar(jar.id)}
                                class="p-1 text-red-600 hover:text-red-700"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-5 w-5"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                            </button>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>

    <div
        class="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4"
    >
        <textarea bind:value={buildDataInput} class="w-full h-full"></textarea>
        <span class="text-xs text-gray-500">
            {valid ? "Valid" : "Invalid"}
        </span>
    </div>
</div>
