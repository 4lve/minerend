<script lang="ts">
    import {
        blockAnimations,
        fileToTexture,
        getColormapColor,
        loadBlockFileTexture,
        loadBlockModel,
        loadBlockTexture,
        loadColormaps,
        textureToImageData,
    } from "$lib/blockRenderer";
    import type { BlockModel, Block as BlockType, Rotation } from "$lib/types";
    import { T, useTask, useThrelte } from "@threlte/core";
    import { OrbitControls, Gizmo } from "@threlte/extras";
    import * as THREE from "three";
    import Block from "./Block.svelte";
    import { deserializeStructure } from "$lib/buildingGadgets";
    import { get } from "svelte/store";
    import { jars } from "$lib/jarStore";

    function getBlockKey(block: BlockType) {
        return `${block.name}-${JSON.stringify(block.properties)}`;
    }

    function getMissingTextures(): {
        blockModel: BlockModel;
        rotation: Rotation;
        uvlock: boolean;
        loadedTextures: Record<string, THREE.Texture>;
    } {
        const blockModel: BlockModel = {
            elements: [
                {
                    from: [0, 0, 0],
                    to: [0, 0, 0],
                    faces: {
                        up: {
                            texture: "#all",
                        },
                    },
                },
            ],
        };

        return {
            blockModel,
            rotation: { x: 0, y: 0, z: 0 },
            uvlock: false,
            loadedTextures: {
                all: new THREE.TextureLoader().load("missing.png"),
            },
        };
    }

    let { blocks }: { blocks: BlockType[] } = $props();
    let grassColormap: ImageData | undefined = $state();
    let foliageColormap: ImageData | undefined = $state();
    const uniqueBlocks = $derived.by(() => {
        const uniqueBlocks = new Map<string, BlockType>();
        blocks.forEach((block) => {
            const key = getBlockKey(block);
            uniqueBlocks.set(key, block);
        });
        return Array.from(uniqueBlocks.entries());
    });

    const loadedBlocks = $derived.by(() => {
        return uniqueBlocks.map(
            async ([key, block]): Promise<
                [
                    string,
                    {
                        blockModel: BlockModel;
                        rotation: Rotation;
                        uvlock: boolean;
                        loadedTextures: Record<string, THREE.Texture>;
                    },
                ]
            > => {
                const blockData = await loadBlockModel(
                    block.name,
                    false,
                    block.properties,
                );
                if (!blockData) return [key, getMissingTextures()];
                const blockModel = blockData[0];
                const rotation = blockData[1].rotation;
                const uvlock = blockData[1].uvlock;

                const textures = await loadBlockTexture(blockModel);

                const textureEntries = await Promise.all(
                    Object.entries(await loadBlockFileTexture(textures)).map(
                        async ([key, [file, metadata]]) => [
                            key,
                            await fileToTexture(file, metadata),
                        ],
                    ),
                );
                const loadedTextures = Object.fromEntries(textureEntries);

                return [
                    key,
                    {
                        blockModel,
                        rotation,
                        uvlock,
                        loadedTextures,
                    },
                ];
            },
        );
    });

    let frames = $state(0);
    let ticks = $state(0);
    const { invalidate } = useThrelte();

    $effect(() => {
        console.log(loadedBlocks.length);
    });

    $effect(() => {
        //Wait for jars to be loaded
        (async () => {
            while (get(jars).length === 0) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
            loadColormaps().then(async (colormaps) => {
                if (!colormaps) return;
                grassColormap = await textureToImageData(
                    colormaps.grassTexture,
                );
                foliageColormap = await textureToImageData(
                    colormaps.foliageTexture,
                );
            });
        })();

        setInterval(() => {
            frames++;
            if (frames > 20) {
                ticks++;
                frames = 0;
                console.log("ticks", ticks);
                $blockAnimations.forEach((animation) => {
                    animation.texture.offset.y =
                        1 - (1 / animation.frames) * (ticks % animation.frames);
                    invalidate();
                });
            }
        }, 1000 / 20);
    });
</script>

<T.AmbientLight position={[0, 0, 0]} args={[0xffffff, 0.3]} />
<T.DirectionalLight position={[5, 5, 5]} intensity={0.3} />

<T.Group>
    {#if foliageColormap && grassColormap}
        {#await Promise.all(loadedBlocks) then loadedBlocksAwaited}
            {#each blocks as block}
                {@const blockData = loadedBlocksAwaited.find(
                    ([key, _]) => key === getBlockKey(block),
                )}
                {#if blockData && blockData[1]}
                    <Block
                        blockModel={blockData[1].blockModel}
                        rotation={blockData[1].rotation}
                        uvlock={blockData[1].uvlock}
                        loadedTextures={blockData[1].loadedTextures}
                        {foliageColormap}
                        {grassColormap}
                        position={block.position}
                    />
                {/if}
            {/each}
        {/await}
    {/if}
</T.Group>
