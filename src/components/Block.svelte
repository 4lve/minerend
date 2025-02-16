<script lang="ts">
    import {
        fileToTexture,
        getColormapColor,
        loadBlockFileTexture,
        loadBlockModel,
        loadBlockTexture,
        loadColormaps,
        textureToImageData,
    } from "$lib/blockRenderer";
    import type { BlockModel } from "$lib/types";
    import { T } from "@threlte/core";
    import { interactivity } from "@threlte/extras";
    import * as THREE from "three";

    let {
        position,
        grassColormap,
        foliageColormap,
        loadedTextures,
        blockModel,
        rotation,
        uvlock,
    }: {
        position: [number, number, number];
        grassColormap: ImageData;
        foliageColormap: ImageData;
        loadedTextures: Record<string, THREE.Texture>;
        blockModel: BlockModel;
        rotation: { x: number; y: number; z: number };
        uvlock: boolean;
    } = $props();
    //plains
    let temperature = $state(0.8);
    let humidity = $state(0.4);

    const faceMap: Record<string, number> = {
        right: 0,
        east: 0,

        left: 1,
        west: 1,

        top: 2,
        up: 2,

        bottom: 3,
        down: 3,

        front: 4,
        north: 4,

        back: 5,
        south: 5,
    };
</script>

{#if blockModel && loadedTextures && grassColormap && foliageColormap}
    <T.Mesh
        rotation={[
            rotation.x * (Math.PI / 180),
            -rotation.y * (Math.PI / 180),
            rotation.z * (Math.PI / 180),
            "YXZ",
        ]}
        {position}
    >
        {#each blockModel.elements! as element}
            <T.Mesh
                position={[
                    (element.from[0] +
                        (element.to[0] - element.from[0]) / 2 -
                        8) /
                        16,
                    (element.from[1] +
                        (element.to[1] - element.from[1]) / 2 -
                        8) /
                        16,
                    (element.from[2] +
                        (element.to[2] - element.from[2]) / 2 -
                        8) /
                        16,
                ]}
            >
                <T.BoxGeometry
                    args={[
                        Math.abs(element.to[0] - element.from[0]) / 16,
                        Math.abs(element.to[1] - element.from[1]) / 16,
                        Math.abs(element.to[2] - element.from[2]) / 16,
                    ]}
                >
                    {#each Object.entries(faceMap) as [face, facePos]}
                        {@const faceData = element.faces[face]}
                        {#if faceData}
                            <T.BufferAttribute
                                attach={({
                                    ref,
                                    parent,
                                    parentObject3D,
                                }: {
                                    ref: typeof THREE.BufferAttribute;
                                    parent: unknown;
                                    parentObject3D: THREE.Object3D;
                                }) => {
                                    const geometry =
                                        parent as THREE.BufferGeometry;
                                    const uvs = geometry.attributes
                                        .uv as THREE.BufferAttribute;
                                    if (!uvs) return;

                                    const uvArray = uvs.array as Float32Array;
                                    const faceVertices = 4; // 4 vertices per face
                                    const componentsPerUV = 2; // 2 components per UV (u,v)
                                    const offset =
                                        facePos *
                                        faceVertices *
                                        componentsPerUV;

                                    let u1, v1, u2, v2;
                                    if (faceData.uv) {
                                        [u1, v1, u2, v2] = faceData.uv;
                                    } else {
                                        // Calculate automatic UVs based on the face and element dimensions
                                        const _from = element.from;
                                        const _to = element.to;

                                        switch (face) {
                                            case "north":
                                            case "south":
                                                [u1, v1, u2, v2] = [
                                                    face === "north"
                                                        ? _to[0]
                                                        : _from[0],
                                                    16 - _from[1],
                                                    face === "north"
                                                        ? _from[0]
                                                        : _to[0],
                                                    16 - _to[1],
                                                ];
                                                break;
                                            case "east":
                                            case "west":
                                                [u1, v1, u2, v2] = [
                                                    _from[2],
                                                    16 - _from[1],
                                                    _to[2],
                                                    16 - _to[1],
                                                ];
                                                break;
                                            case "up":
                                                [u1, v1, u2, v2] = [
                                                    _from[0],
                                                    _from[2],
                                                    _to[0],
                                                    _to[2],
                                                ];
                                                break;
                                            case "down":
                                                [u1, v1, u2, v2] = [
                                                    _from[0],
                                                    _to[2],
                                                    _to[0],
                                                    _from[2],
                                                ];
                                                break;
                                            default:
                                                [u1, v1, u2, v2] = [
                                                    0, 0, 16, 16,
                                                ];
                                        }
                                    }

                                    // Convert Minecraft UV (0-16) to Three.js UV (0-1)
                                    const uvCoords = [
                                        u1 / 16,
                                        1 - v1 / 16, // bottom left
                                        u2 / 16,
                                        1 - v1 / 16, // bottom right
                                        u1 / 16,
                                        1 - v2 / 16, // top left
                                        u2 / 16,
                                        1 - v2 / 16, // top right
                                    ];

                                    for (let i = 0; i < uvCoords.length; i++) {
                                        uvArray[offset + i] = uvCoords[i];
                                    }

                                    uvs.needsUpdate = true;
                                }}
                            />
                        {/if}
                    {/each}
                </T.BoxGeometry>
                {#each Object.entries(faceMap) as [face, facePos]}
                    {@const faceData = element.faces[face]}
                    {#if faceData && loadedTextures[faceData.texture.replace("#", "")]}
                        <T.MeshStandardMaterial
                            transparent={true}
                            map={loadedTextures[
                                faceData.texture.replace("#", "")
                            ]}
                            color={faceData.tintindex === 0
                                ? getColormapColor(
                                      grassColormap,
                                      temperature,
                                      humidity,
                                  )
                                : faceData.tintindex === 1
                                  ? getColormapColor(
                                        foliageColormap,
                                        temperature,
                                        humidity,
                                    )
                                  : "white"}
                            flatShading={true}
                            attach={({
                                parent,
                                ref,
                            }: {
                                parent: any;
                                ref: any;
                            }) => {
                                if (!Array.isArray(parent.material)) {
                                    parent.material = new Array(6).fill(null);
                                }
                                parent.material[facePos] = ref;
                            }}
                        />
                    {/if}
                {/each}
            </T.Mesh>
        {/each}
    </T.Mesh>
{/if}
