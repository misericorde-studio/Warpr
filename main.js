import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const config = {
    innerRadius: 0.50,
    outerRadius: 4.80,
    innerCircleParticles: 100,
    outerCircleParticles: 2000,
    baseParticleSize: 0.45,
    outerCircleParticleSize: 0.75,
    outerCircleBorderParticleSize: 0.75,
    outerCircleWidth: 0.5,
    outerCircleDensity: 0.4,
    innerBorderWidth: 0.30,
    outerBorderWidth: 0.30,
    innerBorderParticleRatio: 0.20,
    outerBorderParticleRatio: 0.20,
    perspectiveEffect: 0,
    staticRingWidth: 0.75,
    outerOutwardRatio: 0.6,
    innerCircleFill: 0.8,
    maxParticleDistance: 1,
    particleSpeed: 0.005,
    fadeWithDistance: 1,
    particleColor: 0xffffff,
    splitCircleColor: 0x00ffcc,
    minMobileRatio: 0.7,
    additionalCircles: 4,
    whiteCircleParticles: 100,
    greenCircleParticles: 100,
    greenCircleExtraParticles: 500,
    whiteCircleParticleScale: 0.7,
    greenCircleParticleScale: 0.8,
    additionalCircleVerticalSpacing: 0.15,
    additionalCircleBorderRatio: 0.45,
    additionalCircleBorderScale: 0.4,
    additionalCircleBorderWidth: 0.15,
    splitAnimation: {
        gridSize: 3,
        spacing: 1.5,
        circleRadius: 0.15,
        circleFill: 0.9,
        transitionDuration: 1.0,
        active: false,
        particleScale: 0.2,
        currentSizeMultiplier: 1.0,
        otherCirclesOpacity: 1.0,
        borderParticleRatio: 0.6,
        borderParticleScale: 0.2,
    }
};
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const scrollConfig = {
    startRotationX: 90,
    endRotationX: 11,
    startDistance: 13,
    endDistance: 4.45,
    splitStart: 0,
    splitEnd: 1,
};
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0C0E13);
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x0C0E13, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enabled = false;
let particles;
let innerParticles;
let outerParticles;
let innerGeometry;
let outerGeometry;
let innerMaterial;
let outerMaterial;
let particlesGroup;
let outerCircleGroup;
let frameCount = 0;
let lastTime = performance.now();
let fpsTime = 0;
const fpsUpdateInterval = 500;
let hasScrolled = false;
function init() {
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
        canvasContainer.innerHTML = '';
        canvasContainer.appendChild(renderer.domElement);
        camera.position.set(0, 0, scrollConfig.startDistance);
        camera.lookAt(0, 0, 0);
        particles = createParticles();
        outerParticles = particles.filter(p => !p.isInnerCircle && !p.isAdditionalCircle);
        innerParticles = particles.filter(p => p.isInnerCircle || p.isAdditionalCircle);
        innerGeometry = new THREE.BufferGeometry();
        outerGeometry = new THREE.BufferGeometry();
        const outerPositions = new Float32Array(outerParticles.length * 3);
        const outerSizes = new Float32Array(outerParticles.length);
        const outerColors = new Float32Array(outerParticles.length * 3);
        const outerOpacities = new Float32Array(outerParticles.length);
        const innerPositions = new Float32Array(innerParticles.length * 3);
        const innerSizes = new Float32Array(innerParticles.length);
        const innerColors = new Float32Array(innerParticles.length * 3);
        const innerOpacities = new Float32Array(innerParticles.length);
        outerGeometry.setAttribute('position', new THREE.BufferAttribute(outerPositions, 3));
        outerGeometry.setAttribute('size', new THREE.BufferAttribute(outerSizes, 1));
        outerGeometry.setAttribute('color', new THREE.BufferAttribute(outerColors, 3));
        outerGeometry.setAttribute('opacity', new THREE.BufferAttribute(outerOpacities, 1));
        innerGeometry.setAttribute('position', new THREE.BufferAttribute(innerPositions, 3));
        innerGeometry.setAttribute('size', new THREE.BufferAttribute(innerSizes, 1));
        innerGeometry.setAttribute('color', new THREE.BufferAttribute(innerColors, 3));
        innerGeometry.setAttribute('opacity', new THREE.BufferAttribute(innerOpacities, 1));
        outerMaterial = createParticlesMaterial(false);
        innerMaterial = createParticlesMaterial(true);
        const outerParticlesObject = new THREE.Points(outerGeometry, outerMaterial);
        const innerParticlesObject = new THREE.Points(innerGeometry, innerMaterial);
        particlesGroup = new THREE.Group();
        outerCircleGroup = new THREE.Group();
        outerCircleGroup.add(outerParticlesObject);
        particlesGroup.add(outerCircleGroup);
        particlesGroup.add(innerParticlesObject);
        particlesGroup.rotation.x = THREE.MathUtils.degToRad(scrollConfig.startRotationX);
        scene.add(particlesGroup);
        controls.enabled = false;
        animate();
    }
}
function createSeparateGeometries() {
    const outerParticles = particles.filter(p => !p.isInnerCircle && !p.isAdditionalCircle);
    const innerParticles = particles.filter(p => p.isInnerCircle || p.isAdditionalCircle);
    const outerGeometry = new THREE.BufferGeometry();
    const outerPositions = new Float32Array(outerParticles.length * 3);
    const outerSizes = new Float32Array(outerParticles.length);
    const outerColors = new Float32Array(outerParticles.length * 3);
    const outerOpacities = new Float32Array(outerParticles.length);
    const innerGeometry = new THREE.BufferGeometry();
    const innerPositions = new Float32Array(innerParticles.length * 3);
    const innerSizes = new Float32Array(innerParticles.length);
    const innerColors = new Float32Array(innerParticles.length * 3);
    const innerOpacities = new Float32Array(innerParticles.length);
    outerGeometry.setAttribute('position', new THREE.BufferAttribute(outerPositions, 3));
    outerGeometry.setAttribute('size', new THREE.BufferAttribute(outerSizes, 1));
    outerGeometry.setAttribute('color', new THREE.BufferAttribute(outerColors, 3));
    outerGeometry.setAttribute('opacity', new THREE.BufferAttribute(outerOpacities, 1));
    innerGeometry.setAttribute('position', new THREE.BufferAttribute(innerPositions, 3));
    innerGeometry.setAttribute('size', new THREE.BufferAttribute(innerSizes, 1));
    innerGeometry.setAttribute('color', new THREE.BufferAttribute(innerColors, 3));
    innerGeometry.setAttribute('opacity', new THREE.BufferAttribute(innerOpacities, 1));
    return { outerGeometry, innerGeometry };
}
function updateCameraFromScroll() {
    const sections = document.querySelectorAll('.airdrop_content');
    if (sections.length < 3) return;
    const secondSection = sections[1];
    const thirdSection = sections[2];
    const secondSectionRect = secondSection.getBoundingClientRect();
    const thirdSectionRect = thirdSection.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;
    const globalProgress = (scrolled / scrollHeight) * 100;
    const outerCircleStartFade = 36;
    const outerCircleEndFade = 38;
    const sizeReductionStart = 20;
    const sizeReductionEnd = 38;
    const verticalSpacingStart = 20;
    const verticalSpacingEnd = 60;
    const shrinkStart = 55;
    const shrinkStartClose = 58;
    const shrinkEnd = 70;
    const innerColorStart = 68;
    const innerColorEnd = 70;
    const splitStart = 65;
    const splitEnd = 95;
    const outerCircleProgress = Math.min(1, Math.max(0, (globalProgress - outerCircleStartFade) / (outerCircleEndFade - outerCircleStartFade)));
    const sizeReductionProgress = Math.min(1, Math.max(0, (globalProgress - sizeReductionStart) / (sizeReductionEnd - sizeReductionStart)));
    const verticalSpacingProgress = Math.min(1, Math.max(0, (globalProgress - verticalSpacingStart) / (verticalSpacingEnd - verticalSpacingStart)));
    const shrinkProgress = Math.min(1, Math.max(0, (globalProgress - shrinkStart) / (shrinkEnd - shrinkStart)));
    const shrinkProgressClose = Math.min(1, Math.max(0, (globalProgress - shrinkStartClose) / (shrinkEnd - shrinkStartClose)));
    const innerColorProgress = Math.min(1, Math.max(0, (globalProgress - innerColorStart) / (innerColorEnd - innerColorStart)));
    const splitProgress = Math.min(1, Math.max(0, (globalProgress - splitStart) / (splitEnd - splitStart)));
    const startColor = new THREE.Color(0xffffff);
    const endColor = new THREE.Color(0x0C0E13);
    const smoothProgress = Math.pow(outerCircleProgress, 0.5);
    const smoothSizeProgress = Math.pow(sizeReductionProgress, 0.5);
    const currentColor = startColor.clone().lerp(endColor, smoothProgress);
    let opacity = 1.0;
    if (smoothProgress > 0.95) {
        opacity = 1.0 - ((smoothProgress - 0.95) * 20);
    }
    const colors = outerGeometry.attributes.color;
    const opacities = outerGeometry.attributes.opacity;
    const sizes = outerGeometry.attributes.size;
    for (let i = 0; i < colors.count; i++) {
        colors.setXYZ(i, currentColor.r, currentColor.g, currentColor.b);
        opacities.setX(i, opacity);
        if (outerParticles[i]) {
            outerParticles[i].color = currentColor;
            outerParticles[i].opacity = opacity;
            const originalSize = outerParticles[i].size;
            const targetSize = originalSize * (1 - smoothSizeProgress);
            outerParticles[i].currentSize = targetSize;
            sizes.setX(i, targetSize);
        }
    }
    colors.needsUpdate = true;
    opacities.needsUpdate = true;
    sizes.needsUpdate = true;
    const startSpacing = config.additionalCircleVerticalSpacing;
    const endSpacing = 1.5;
    const currentSpacing = startSpacing + (endSpacing - startSpacing) * verticalSpacingProgress;
    const startColorSpacing = new THREE.Color(0xffffff);
    const endColorSpacing = new THREE.Color(0x0C0E13);
    const processedIndices = new Set();
    const time = Date.now() * 0.001;
    innerParticles.forEach(particle => {
        if (particle.isInnerCircle || (particle.isAdditionalCircle && particle.additionalCircleIndex !== 1)) {
            const currentColorSpacing = startColorSpacing.clone().lerp(endColorSpacing, innerColorProgress);
            particle.color = currentColorSpacing;
            particle.opacity = 1.0;
            if (shrinkProgress > 0 && !particle.hasBeenSplit) {
                if (!particle.shrinkStartPosition) {
                    particle.shrinkStartPosition = {
                        x: particle.originalX,
                        y: particle.originalY,
                        z: particle.originalZ
                    };
                    particle.originalSize = particle.size;
                }
                let currentProgress;
                if (particle.additionalCircleIndex === 0 || particle.additionalCircleIndex === 2) {
                    currentProgress = shrinkProgressClose;
                } else {
                    currentProgress = shrinkProgress;
                }
                const baseY = particle.shrinkStartPosition.y;
                const nonLinearProgress = Math.pow(currentProgress, 2.0);
                const convergenceSpeed = Math.sqrt(
                    Math.pow(particle.shrinkStartPosition.x, 2) + 
                    Math.pow(particle.shrinkStartPosition.z, 2)
                ) / config.innerRadius;
                const compressionFactor = Math.pow(nonLinearProgress, 0.7);
                const finalScale = 0.2 + (1.0 - compressionFactor) * 0.8;
                particle.originalX = particle.shrinkStartPosition.x * (1 - nonLinearProgress * convergenceSpeed) * finalScale;
                particle.originalZ = particle.shrinkStartPosition.z * (1 - nonLinearProgress * convergenceSpeed) * finalScale;
                particle.originalY = baseY;
                const targetSize = particle.originalSize * 0.4;
                particle.currentSize = particle.originalSize - (particle.originalSize - targetSize) * currentProgress;
                particle.x = particle.originalX;
                particle.y = particle.originalY;
                particle.z = particle.originalZ;
            } else if (shrinkProgress === 0 && particle.shrinkStartPosition) {
                particle.originalX = particle.shrinkStartPosition.x;
                particle.originalZ = particle.shrinkStartPosition.z;
                particle.originalY = particle.shrinkStartPosition.y;
                particle.x = particle.originalX;
                particle.y = particle.originalY;
                particle.z = particle.originalZ;
                particle.currentSize = particle.originalSize;
            }
        }
        const verticalSpeed = 0.8 + (particle.additionalCircleIndex * 0.1);
        const verticalAmplitude = 0.01;
        const individualOffset = particle.index * 0.5;
        const verticalOffset = Math.sin(time * verticalSpeed + individualOffset) * verticalAmplitude;
        let baseY;
        if (particle.isInnerCircle) {
            baseY = 2 * currentSpacing;
        } else if (particle.isAdditionalCircle) {
            if (particle.additionalCircleIndex === 0) {
                baseY = currentSpacing;
            } else if (particle.additionalCircleIndex === 1) {
                baseY = 0;
            } else if (particle.additionalCircleIndex === 2) {
                baseY = -currentSpacing;
            } else if (particle.additionalCircleIndex === 3) {
                baseY = -2 * currentSpacing;
            }
        }
        particle.x = particle.originalX;
        particle.y = baseY + verticalOffset;
        particle.z = particle.originalZ;
    });
    innerGeometry.attributes.position.needsUpdate = true;
    innerGeometry.attributes.color.needsUpdate = true;
    innerGeometry.attributes.opacity.needsUpdate = true;
    const currentRotationX = 90 - (180 * (globalProgress / 100));
    particlesGroup.rotation.x = THREE.MathUtils.degToRad(currentRotationX);
    const cameraProgress = Math.min(1, globalProgress / outerCircleEndFade);
    const currentDistance = scrollConfig.startDistance - 
                          ((scrollConfig.startDistance - scrollConfig.endDistance) * cameraProgress);
    camera.position.z = currentDistance;
    if (splitProgress > 0) {
        config.splitAnimation.active = true;
        config.splitAnimation.currentSizeMultiplier = 1.0;
        config.splitAnimation.otherCirclesOpacity = 1.0 - splitProgress;
        updateSplitAnimation(splitProgress);
    } else {
        config.splitAnimation.active = false;
        config.splitAnimation.currentSizeMultiplier = 1.0;
        config.splitAnimation.otherCirclesOpacity = 1.0;
        updateSplitAnimation(0);
    }
}
function updateSplitAnimation(progress) {
    const centralParticles = particles.filter(p => 
        p.isAdditionalCircle && 
        p.additionalCircleIndex === 1
    );
    if (centralParticles.length === 0 || progress < 0 || progress > 1) {
        return;
    }
    const gridSize = config.splitAnimation.gridSize;
    const totalSubCircles = gridSize * gridSize;
    const particlesPerSubCircle = Math.ceil(centralParticles.length / totalSubCircles);
    centralParticles.forEach((particle, index) => {
        particle.active = true;
        particle.opacity = 1.0;
        if (particle.isExtraGreenParticle) {
            particle.currentSize = particle.size * progress;
        } else {
            particle.currentSize = particle.size;
        }
        if (!particle.originalX) {
            particle.originalX = particle.x;
            particle.originalY = particle.y;
            particle.originalZ = particle.z;
        }
        if (!particle.splitStartPosition) {
            particle.splitStartPosition = {
                x: particle.originalX,
                y: particle.originalY,
                z: particle.originalZ
            };
        }
        if (!particle.splitTarget) {
            const subCircleIndex = Math.floor(index / particlesPerSubCircle);
            const row = Math.floor(subCircleIndex / gridSize);
            const col = subCircleIndex % gridSize;
            const centerX = (col - (gridSize - 1) / 2) * config.splitAnimation.spacing;
            const centerZ = (row - (gridSize - 1) / 2) * config.splitAnimation.spacing;
            particle.isBorder = Math.random() < config.splitAnimation.borderParticleRatio;
            const particleIndexInSubCircle = index % particlesPerSubCircle;
            const angleInSubCircle = (particleIndexInSubCircle / particlesPerSubCircle) * Math.PI * 2;
            let radiusFactor;
            if (particle.isBorder) {
                radiusFactor = 0.8 + Math.random() * 0.4;
            } else {
                radiusFactor = Math.pow(Math.random(), 0.5) * config.splitAnimation.circleFill;
            }
            const finalRadius = config.splitAnimation.circleRadius * radiusFactor;
            particle.splitTarget = {
                x: centerX + Math.cos(angleInSubCircle) * finalRadius,
                z: centerZ + Math.sin(angleInSubCircle) * finalRadius,
                y: particle.y
            };
        }
        const easeProgress = progress < 0.5 
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        const time = Date.now() * 0.001;
        const individualOffset = index * 0.5;
        const verticalSpeed = 0.8;
        const horizontalSpeed = 0.4;
        const verticalAmplitude = 0.15;
        const horizontalAmplitude = 0.1;
        const verticalOffset = Math.sin(time * verticalSpeed + individualOffset) * verticalAmplitude;
        const horizontalOffsetX = Math.cos(time * horizontalSpeed + individualOffset) * horizontalAmplitude;
        const horizontalOffsetZ = Math.sin(time * horizontalSpeed + individualOffset * 1.3) * horizontalAmplitude;
        const baseX = particle.splitStartPosition.x * (1 - easeProgress) + particle.splitTarget.x * easeProgress;
        const baseZ = particle.splitStartPosition.z * (1 - easeProgress) + particle.splitTarget.z * easeProgress;
        const floatProgress = Math.pow(progress, 0.7);
        particle.x = baseX + horizontalOffsetX * floatProgress;
        particle.y = particle.splitStartPosition.y + verticalOffset * floatProgress;
        particle.z = baseZ + horizontalOffsetZ * floatProgress;
        particle.hasBeenSplit = true;
    });
}
class Particle {
    constructor(index) {
        this.index = index;
        this.isInnerCircle = false;
        this.isAdditionalCircle = false;
        this.additionalCircleIndex = -1;
        this.isStatic = false;
        this.hasBeenSplit = false;
        this.floatSpeed = 0;
        this.floatPhase = 0;
        this.splitProgress = 0;
        this.splitTarget = null;
        this.splitStartPosition = null;
        this.splitEndPosition = null;
        this.sizeTransitionStart = 0;
        this.sizeTransitionTarget = 0;
        this.sizeTransitionProgress = 0;
        this.inSizeTransition = false;
        this.opacity = 1.0;
        this.active = true;
    }
    resetParticle() {
        if (this.isInnerCircle || this.isAdditionalCircle) {
            const angle = Math.random() * Math.PI * 2;
            const isBorder = Math.random() < (this.isAdditionalCircle ? config.additionalCircleBorderRatio : config.innerBorderParticleRatio);
            this.isBorder = isBorder;
            let radiusFactor;
            if (isBorder) {
                const borderWidth = this.isAdditionalCircle ? config.additionalCircleBorderWidth : config.innerBorderWidth;
                radiusFactor = 1.0 - borderWidth + Math.random() * (borderWidth * 2);
            } else {
                radiusFactor = Math.pow(Math.random(), 0.5) * config.innerCircleFill;
            }
            this.radius = config.innerRadius * radiusFactor;
            this.isStatic = true;
            this.angle = angle;
            this.x = Math.cos(this.angle) * this.radius;
            this.z = Math.sin(this.angle) * this.radius;
            if (this.isInnerCircle) {
                this.y = 2 * config.additionalCircleVerticalSpacing;
            } else if (this.isAdditionalCircle) {
                if (this.additionalCircleIndex === 1) {
                    this.y = 0;
                } else if (this.additionalCircleIndex === 0) {
                    this.y = config.additionalCircleVerticalSpacing;
                } else {
                    const offset = this.additionalCircleIndex - 1;
                    this.y = -offset * config.additionalCircleVerticalSpacing;
                }
            }
            if (this.isInnerCircle || (this.isAdditionalCircle && this.additionalCircleIndex !== 1)) {
                const baseScale = config.whiteCircleParticleScale;
                this.size = config.baseParticleSize * (isBorder ? config.additionalCircleBorderScale : baseScale) * (0.7 + Math.random() * 0.6);
            } else if (this.isAdditionalCircle && this.additionalCircleIndex === 1) {
                this.size = config.baseParticleSize * (isBorder ? config.additionalCircleBorderScale : config.greenCircleParticleScale) * (0.7 + Math.random() * 0.6);
            }
            this.currentSize = this.size;
            this.direction = 0;
            this.distanceTraveled = 0;
            this.originalX = this.x;
            this.originalY = this.y;
            this.originalZ = this.z;
            this.floatSpeed = 0.08 + Math.random() * 0.07;
            this.floatPhase = Math.random() * Math.PI * 2;
            this.floatAmplitude = 0.04 + Math.random() * 0.04;
            this.x = Math.cos(this.angle) * this.radius;
            this.z = Math.sin(this.angle) * this.radius;
            this.y = 0;
            this.targetX = this.x;
            this.targetZ = this.z;
            this.targetY = this.y;
            this.currentX = this.x;
            this.currentZ = this.z;
            this.currentY = this.y;
            this.velocityX = 0;
            this.velocityZ = 0;
            this.velocityY = 0;
        } else {
            this.resetOuterParticle();
        }
    }
    resetOuterParticle() {
        const wasStatic = this.isStatic;
        if (wasStatic) {
            this.isStatic = true;
            this.opacity = 1.0;
            const angle = this.angle || Math.random() * Math.PI * 2;
            this.angle = angle;
            const random = Math.random();
            const isInnerBorder = random < config.innerBorderParticleRatio;
            const isOuterBorder = !isInnerBorder && random < (config.innerBorderParticleRatio + config.outerBorderParticleRatio);
            this.isBorder = isInnerBorder || isOuterBorder;
            if (isInnerBorder) {
                const randomOffset = (Math.random() - 0.5) * config.innerBorderWidth;
                this.radius = config.outerRadius - config.innerBorderWidth/2 + randomOffset;
                this.size = config.outerCircleBorderParticleSize;
            } else if (isOuterBorder) {
                const randomOffset = (Math.random() - 0.5) * config.outerBorderWidth;
                this.radius = config.outerRadius + config.outerBorderWidth/2 + randomOffset;
                this.size = config.outerCircleBorderParticleSize;
            } else {
                const randomOffset = (Math.random() - 0.5) * config.outerCircleWidth;
                this.radius = config.outerRadius + randomOffset;
                this.size = config.outerCircleParticleSize;
            }
            this.floatSpeed = this.floatSpeed || (0.03 + Math.random() * 0.03);
            this.floatPhase = this.floatPhase || Math.random() * Math.PI * 2;
            this.floatAmplitude = this.floatAmplitude || (0.04 + Math.random() * 0.04);
            this.x = Math.cos(this.angle) * this.radius;
            this.z = Math.sin(this.angle) * this.radius;
            this.y = 0;
            this.currentSize = this.size;
            this.opacity = 1.0;
            this.active = true;
        } else {
            this.isStatic = false;
            this.isBorder = false;
            this.radius = config.outerRadius;
            this.size = config.outerCircleParticleSize;
            this.currentSize = this.size;
            this.speed = config.particleSpeed * (0.2 + Math.random() * 0.3);
            this.direction = Math.random() < config.outerOutwardRatio ? 1 : -1;
            const angle = Math.random() * Math.PI * 2;
            this.angle = angle;
            this.x = Math.cos(angle) * this.radius;
            this.z = Math.sin(angle) * this.radius;
            this.y = 0;
            this.floatSpeed = 0;
            this.floatPhase = 0;
            this.floatAmplitude = 0;
            this.distanceTraveled = 0;
            this.opacity = 0;
            this.fadeState = 'in';
            this.fadeProgress = 0;
            this.active = true;
            const currentRadius = this.radius + this.distanceTraveled;
            if (Math.abs(this.distanceTraveled) > config.maxParticleDistance || 
                (this.direction < 0 && currentRadius <= config.innerRadius)) {
                this.fadeState = 'out';
                this.fadeProgress = 1;
            }
        }
    }
    update(deltaTime) {
        if (!this.active) return;
        if (this.isAdditionalCircle && this.additionalCircleIndex === 1) {
            return;
        }
        if (!this.isStatic) {
            this.distanceTraveled += this.speed * this.direction;
            const currentRadius = this.radius + this.distanceTraveled;
            if (Math.abs(this.distanceTraveled) > config.maxParticleDistance || 
                (this.direction < 0 && currentRadius <= config.innerRadius)) {
                if (this.fadeState !== 'out') {
                    this.fadeState = 'out';
                    this.fadeProgress = 1;
                }
            }
            const fadeSpeed = 0.05;
            if (this.fadeState === 'in') {
                this.fadeProgress += fadeSpeed;
                if (this.fadeProgress >= 1) {
                    this.fadeProgress = 1;
                    this.fadeState = 'visible';
                }
                this.opacity = this.fadeProgress;
            } else if (this.fadeState === 'out') {
                this.fadeProgress -= fadeSpeed;
                if (this.fadeProgress <= 0) {
                    this.resetOuterParticle();
                    return;
                }
                this.opacity = this.fadeProgress;
            }
            this.x = Math.cos(this.angle) * currentRadius;
            this.z = Math.sin(this.angle) * currentRadius;
            this.y = 0;
            const distanceRatio = Math.abs(this.distanceTraveled) / config.maxParticleDistance;
            const sizeFactor = 1 - distanceRatio;
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrolled = window.scrollY;
            const globalProgress = (scrolled / scrollHeight) * 100;
            const sizeReductionStart = 20;
            const sizeReductionEnd = 38;
            const sizeReductionProgress = Math.min(1, Math.max(0, (globalProgress - sizeReductionStart) / (sizeReductionEnd - sizeReductionStart)));
            const smoothSizeProgress = Math.pow(sizeReductionProgress, 0.5);
            const finalSizeFactor = sizeFactor * (1 - smoothSizeProgress);
            this.currentSize = this.size * finalSizeFactor;
        } else {
            if (!this.floatSpeed || !this.floatPhase || !this.floatAmplitude) {
                this.floatSpeed = 0.03 + Math.random() * 0.03;
                this.floatPhase = Math.random() * Math.PI * 2;
                this.floatAmplitude = 0.04 + Math.random() * 0.04;
            }
            this.floatPhase += this.floatSpeed * deltaTime * 30;
            const xOffset = Math.sin(this.floatPhase * 0.5) * this.floatAmplitude * 1.2;
            const yOffset = Math.cos(this.floatPhase * 0.7) * this.floatAmplitude * 1.2;
            const zOffset = Math.sin(this.floatPhase * 0.6) * this.floatAmplitude * 1.2;
            const baseX = Math.cos(this.angle) * this.radius;
            const baseZ = Math.sin(this.angle) * this.radius;
            this.x = baseX + xOffset;
            this.y = yOffset;
            this.z = baseZ + zOffset;
            this.currentSize = this.size;
            this.opacity = 1.0;
        }
    }
}
function createParticlesGeometry() {
    const totalParticles = config.innerCircleParticles + 
                         (config.additionalCircles * config.additionalCircleParticles) + 
                         config.outerCircleParticles;
    const positions = new Float32Array(totalParticles * 3);
    const sizes = new Float32Array(totalParticles);
    const colors = new Float32Array(totalParticles * 3);
    const opacities = new Float32Array(totalParticles);
    for (let i = 0; i < totalParticles; i++) {
        const idx = i * 3;
        positions[idx] = 0;
        positions[idx + 1] = 0;
        positions[idx + 2] = 0;
        sizes[i] = config.baseParticleSize;
        const color = new THREE.Color(config.particleColor);
        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;
        opacities[i] = 1.0;
    }
    const baseColor = {
        main: new THREE.Color(config.particleColor),
        split: new THREE.Color(config.splitCircleColor)
    };
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    return { geometry, positions, sizes, colors, opacities, baseColor };
}
function createParticlesMaterial(isOuterCircle = false) {
    return new THREE.ShaderMaterial({
        uniforms: {
            cameraPos: { value: camera.position }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            attribute float opacity;
            varying vec3 vColor;
            varying float vOpacity;
            uniform vec3 cameraPos;
            void main() {
                vColor = color;
                vOpacity = opacity;
                float distanceToCamera = distance(position, cameraPos);
                float scaleFactor = 1.0 - (distanceToCamera * ${config.perspectiveEffect.toFixed(2)}) / 10.0;
                float adjustedSize = size * max(scaleFactor, 0.3);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = adjustedSize * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vOpacity;
            void main() {
                vec2 center = vec2(0.5, 0.5);
                float dist = length(gl_PointCoord - center);
                float threshold = 0.25;
                float alpha = 1.0 - smoothstep(threshold, threshold + 0.01, dist);
                alpha *= pow(vOpacity, 1.5);
                vec3 finalColor = vColor;
                if(finalColor.r <= 0.05 && finalColor.g <= 0.06 && finalColor.b <= 0.08) {
                    finalColor = vec3(0.047, 0.055, 0.075);
                    alpha = 0.0;
                }
                gl_FragColor = vec4(finalColor, alpha);
                if (dist > threshold + 0.01 || alpha < 0.01) discard;
            }
        `,
        transparent: true,
        depthTest: true,
        depthWrite: isOuterCircle,
        blending: THREE.NormalBlending
    });
}
function createParticles() {
    const particles = [];
    let index = 0;
    for (let i = 0; i < config.innerCircleParticles; i++) {
        const particle = new Particle(index++);
        particle.isInnerCircle = true;
        particle.isAdditionalCircle = false;
        particle.additionalCircleIndex = -1;
        particle.isStatic = true;
        particle.resetParticle();
        particles.push(particle);
    }
    for (let circleIndex = 0; circleIndex < config.additionalCircles; circleIndex++) {
        const particleCount = circleIndex === 1 ? 
            (config.greenCircleParticles + config.greenCircleExtraParticles) : 
            config.whiteCircleParticles;
        const particleScale = circleIndex === 1 ? config.greenCircleParticleScale : config.whiteCircleParticleScale;
        for (let i = 0; i < particleCount; i++) {
            const particle = new Particle(index++);
            particle.isInnerCircle = false;
            particle.isAdditionalCircle = true;
            particle.additionalCircleIndex = circleIndex;
            particle.isStatic = true;
            particle.particleScale = particleScale;
            if (circleIndex === 1 && i >= config.greenCircleParticles) {
                particle.isExtraGreenParticle = true;
                particle.size = config.baseParticleSize * particleScale;
                particle.currentSize = 0;
                particle.opacity = 1;
            }
            particle.resetParticle();
            if (particle.isExtraGreenParticle) {
                particle.currentSize = 0;
            }
            particles.push(particle);
        }
    }
    let staticCount = 0;
    let mobileCount = 0;
    const targetMobileRatio = 0.4;
    for (let i = 0; i < config.outerCircleParticles; i++) {
        const particle = new Particle(index++);
        particle.isInnerCircle = false;
        particle.isAdditionalCircle = false;
        particle.additionalCircleIndex = -1;
        const currentMobileRatio = mobileCount / (staticCount + mobileCount + 1);
        const shouldBeMobile = currentMobileRatio < targetMobileRatio;
        particle.isStatic = !shouldBeMobile;
        particle.resetOuterParticle();
        if (shouldBeMobile) {
            mobileCount++;
        } else {
            staticCount++;
        }
        particles.push(particle);
    }
    return particles;
}
function createGuideCircles() {
    return new THREE.Group();
}
let guideCircles = createGuideCircles();
scene.add(guideCircles);
function updateRendererSize() {
    const container = document.getElementById('canvas-container');
    if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
}
window.addEventListener('resize', updateRendererSize);
function updateCameraInfo() {
    const rotationXElement = document.getElementById('rotation-x');
    const rotationYElement = document.getElementById('rotation-y');
    const rotationZElement = document.getElementById('rotation-z');
    const distanceElement = document.getElementById('camera-distance');
    const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const sections = document.querySelectorAll('.airdrop_content');
    let scrollProgress = 0;
    if (sections.length >= 2) {
        const secondSection = sections[1];
        const secondSectionRect = secondSection.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        scrollProgress = 1 - (secondSectionRect.top / viewportHeight);
        scrollProgress = Math.max(0, Math.min(1, scrollProgress));
    }
    const rotX = scrollConfig.startRotationX + 
                (scrollConfig.endRotationX - scrollConfig.startRotationX) * scrollProgress;
    if (rotationXElement && rotationYElement && rotationZElement && distanceElement) {
        rotationXElement.textContent = rotX.toFixed(2);
        rotationYElement.textContent = "0.00";
        rotationZElement.textContent = "-180.00";
        distanceElement.textContent = distance.toFixed(2);
    }
}
function formatMemorySize(bytes) {
    return (bytes / 1024 / 1024).toFixed(2);
}
function updatePerformanceStats(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    frameCount++;
    fpsTime += deltaTime;
    if (fpsTime >= fpsUpdateInterval) {
        const fps = Math.round((frameCount * 1000) / fpsTime);
        const frameTime = (fpsTime / frameCount).toFixed(2);
        const activeParticles = particles.filter(p => p.active).length;
        const fpsElement = document.getElementById('fps-value');
        const frameTimeElement = document.getElementById('frame-time-value');
        const particlesElement = document.getElementById('particles-value');
        const memoryElement = document.getElementById('memory-value');
        if (fpsElement) {
            fpsElement.textContent = fps;
        }
        if (frameTimeElement) {
            frameTimeElement.textContent = `${frameTime} ms`;
        }
        if (particlesElement) {
            particlesElement.textContent = activeParticles;
        }
        if (window.performance && window.performance.memory && memoryElement) {
            const memory = formatMemorySize(window.performance.memory.usedJSHeapSize);
            memoryElement.textContent = `${memory} MB`;
        }
        frameCount = 0;
        fpsTime = 0;
    }
}
function animate() {
    requestAnimationFrame(animate);
    let shrinkProgress = 0;
    if (hasScrolled) {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = window.scrollY;
        const globalProgress = (scrolled / scrollHeight) * 100;
        const shrinkStart = 55;
        const shrinkEnd = 70;
        shrinkProgress = Math.min(1, Math.max(0, (globalProgress - shrinkStart) / (shrinkEnd - shrinkStart)));
        updateCameraFromScroll();
    } else {
        outerParticles.forEach((particle, i) => {
            const idx = i * 3;
            outerGeometry.attributes.color.array[idx] = 1;
            outerGeometry.attributes.color.array[idx + 1] = 1;
            outerGeometry.attributes.color.array[idx + 2] = 1;
        });
        outerGeometry.attributes.color.needsUpdate = true;
    }
    const mainColor = new THREE.Color(config.particleColor);
    const splitColor = new THREE.Color(config.splitCircleColor);
    let movingCount = 0;
    const time = Date.now() * 0.001;
    innerParticles.forEach((particle, i) => {
        if (!particle.active) return;
        if (!particle.isStatic) {
            particle.update(0.016);
        }
        const idx = i * 3;
        if (particle.isAdditionalCircle || particle.isInnerCircle) {
            if (particle.floatPhase === undefined) {
                particle.floatPhase = Math.random() * Math.PI * 2;
            }
            let floatScale = 1.0;
            if (shrinkProgress > 0 && !particle.hasBeenSplit) {
                const targetSize = particle.originalSize * 0.4;
                const currentSizeRatio = (particle.currentSize - targetSize) / (particle.originalSize - targetSize);
                floatScale = Math.max(0.2, currentSizeRatio);
            }
            const verticalOffset = Math.sin(time * 1.2 + particle.floatPhase) * 0.05 * floatScale;
            const horizontalOffset = Math.cos(time * 0.8 + particle.floatPhase) * 0.03 * floatScale;
            innerGeometry.attributes.position.array[idx] = particle.x + horizontalOffset;
            innerGeometry.attributes.position.array[idx + 1] = particle.y + verticalOffset;
            innerGeometry.attributes.position.array[idx + 2] = particle.z + horizontalOffset;
        } else {
            innerGeometry.attributes.position.array[idx] = particle.x;
            innerGeometry.attributes.position.array[idx + 1] = particle.y;
            innerGeometry.attributes.position.array[idx + 2] = particle.z;
        }
        innerGeometry.attributes.size.array[i] = particle.currentSize;
        const color = particle.isAdditionalCircle && particle.additionalCircleIndex === 1 ? 
            splitColor : (particle.color || mainColor);
        innerGeometry.attributes.color.array[idx] = color.r;
        innerGeometry.attributes.color.array[idx + 1] = color.g;
        innerGeometry.attributes.color.array[idx + 2] = color.b;
        innerGeometry.attributes.opacity.array[i] = particle.opacity;
    });
    outerParticles.forEach((particle, i) => {
        if (!particle.active) return;
        if (!particle.isStatic) {
            particle.update(0.016);
            movingCount++;
        } else {
            if (!particle.floatSpeed || !particle.floatPhase || !particle.floatAmplitude) {
                particle.floatSpeed = 0.03 + Math.random() * 0.03;
                particle.floatPhase = Math.random() * Math.PI * 2;
                particle.floatAmplitude = 0.04 + Math.random() * 0.04;
            }
            particle.floatPhase += particle.floatSpeed * 0.016 * 30;
            const xOffset = Math.sin(particle.floatPhase * 0.5) * particle.floatAmplitude * 1.2;
            const yOffset = Math.cos(particle.floatPhase * 0.7) * particle.floatAmplitude * 1.2;
            const zOffset = Math.sin(particle.floatPhase * 0.6) * particle.floatAmplitude * 1.2;
            const baseX = Math.cos(particle.angle) * particle.radius;
            const baseZ = Math.sin(particle.angle) * particle.radius;
            particle.x = baseX + xOffset;
            particle.y = yOffset;
            particle.z = baseZ + zOffset;
        }
        const idx = i * 3;
        outerGeometry.attributes.position.array[idx] = particle.x;
        outerGeometry.attributes.position.array[idx + 1] = particle.y;
        outerGeometry.attributes.position.array[idx + 2] = particle.z;
        outerGeometry.attributes.size.array[i] = particle.currentSize;
        outerGeometry.attributes.opacity.array[i] = particle.opacity;
    });
    const minMobileParticles = Math.floor(config.outerCircleParticles * config.minMobileRatio);
    if (movingCount < minMobileParticles && frameCount % 10 === 0) {
        const particlesToConvert = Math.min(50, minMobileParticles - movingCount);
        let resetCount = 0;
        for (let i = 0; i < outerParticles.length && resetCount < particlesToConvert; i++) {
            const particle = outerParticles[i];
            if (particle.isStatic) {
                particle.isStatic = false;
                particle.direction = Math.random() < 0.7 ? -1 : 1;
                particle.speed = config.particleSpeed * (0.7 + Math.random() * 0.6);
                particle.distanceTraveled = 0;
                resetCount++;
            }
        }
    }
    innerGeometry.attributes.position.needsUpdate = true;
    innerGeometry.attributes.size.needsUpdate = true;
    innerGeometry.attributes.color.needsUpdate = true;
    innerGeometry.attributes.opacity.needsUpdate = true;
    outerGeometry.attributes.position.needsUpdate = true;
    outerGeometry.attributes.size.needsUpdate = true;
    outerGeometry.attributes.color.needsUpdate = true;
    outerGeometry.attributes.opacity.needsUpdate = true;
    renderer.render(scene, camera);
    updatePerformanceStats(performance.now());
}
document.addEventListener('DOMContentLoaded', () => {
    updateRendererSize();
    init();
    window.addEventListener('scroll', () => {
        hasScrolled = true;
        requestAnimationFrame(updateCameraFromScroll);
    });
});
