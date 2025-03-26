import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


// Configuration
const config = {
    // Paramètres des cercles
    innerRadius: 0.5,           // Rayon du cercle intérieur
    outerRadius: 4.70,           // Rayon du cercle extérieur
    
    // Paramètres des particules
    innerCircleParticles: 100, // Nombre de particules dans le cercle intérieur
    outerCircleParticles: 2000, // Nombre de particules dans le cercle extérieur (augmenté)
    baseParticleSize: 0.6,    // Taille de base des particules
    outerCircleParticleSize: 1, // Taille des particules du cercle extérieur
    outerCircleBorderParticleSize: 0.5, // Taille des particules de la bordure
    
    // Paramètres des bordures
    innerBorderWidth: 0.3, // Largeur de la bordure intérieure
    outerBorderWidth: 0.3, // Largeur de la bordure extérieure
    innerBorderParticleRatio: 0.35, // Ratio de particules pour la bordure intérieure (augmenté à 35%)
    outerBorderParticleRatio: 0.35, // Ratio de particules pour la bordure extérieure (augmenté à 35%)
    
    // Paramètres visuels
    perspectiveEffect: 0,   // Effet de perspective (0-1)
    staticRingWidth: 0.75,     // Largeur de l'anneau statique du cercle extérieur
    outerOutwardRatio: 0.6,   // Proportion de particules se déplaçant vers l'extérieur
    innerCircleFill: 0.8,     // Proportion du rayon intérieur à remplir
    
    // Paramètres d'animation
    maxParticleDistance: 1,   // Distance maximale que peuvent parcourir les particules
    particleSpeed: 0.01,      // Vitesse de déplacement des particules
    fadeWithDistance: 1,      // Réduction de taille avec la distance (0-1)
    
    // Paramètres de couleur
    particleColor: 0xffffff,  // Couleur des particules (blanc)
    splitCircleColor: 0x00ffcc, // Couleur du cercle qui se scinde
    
    // NOUVEAU: Paramètres de gestion du flux de particules
    minMobileRatio: 0.7,      // Ratio minimum de particules mobiles
    
    // NOUVEAU: Paramètres pour les cercles supplémentaires
    additionalCircles: 4,      // Nombre de cercles supplémentaires
    additionalCircleParticles: 450, // Nombre de particules par cercle supplémentaire
    additionalCircleVerticalSpacing: 0.5, // Espacement vertical entre les cercles
    additionalCircleParticleScale: 0.7, // Facteur d'échelle pour les particules des cercles verticaux
    
    // Configuration pour l'animation de division
    splitAnimation: {
        gridSize: 3, // 3x3 grid
        spacing: 1.5, // Espacement entre les cercles
        circleRadius: 0.15, // Rayon plus petit des petits cercles (était 0.2)
        circleFill: 0.9, // Remplissage des petits cercles (0-1)
        transitionDuration: 1.0, // Durée de la transition
        active: false, // État de l'animation
        particleScale: 0.3, // Facteur d'échelle plus petit pour les particules des cercles de fin (était 0.5)
        currentSizeMultiplier: 1.0, // Variable pour contrôler la taille actuelle des particules en fonction du scroll
        otherCirclesOpacity: 1.0 // Opacité des autres cercles verticaux (contrôlée par le scroll)
    }
};

// Configuration de la caméra avec un champ de vision adapté
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Configuration de l'animation au scroll
const scrollConfig = {
    startRotationX: 90,  // Rotation X initiale en degrés (vue de dessus)
    endRotationX: 11,    // Rotation X finale en degrés pour le premier mouvement
    startDistance: 13,   // Distance initiale
    endDistance: 4.45,   // Distance finale
    
    // NOUVEAU: Configuration pour les étapes de l'animation
    splitStart: 0, // Début de l'animation de division (sera mis à jour dans updateCameraFromScroll)
    splitEnd: 1,   // Fin de l'animation de division (sera mis à jour dans updateCameraFromScroll)
};

console.log("Configuration de l'animation au scroll:", scrollConfig);

// Initialisation de la scène, caméra et renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0B0E13);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0);

// Contrôles d'orbite
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enabled = false;

// Déclaration des variables globales
let particles;
let geometry;
let positions;
let sizes;
let colors;
let opacities;
let baseColor;
let particlesMaterial;
let particlesObject;
let particlesGroup;

// Modifier la fonction init pour initialiser les particules et le groupe
function init() {
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
        canvasContainer.innerHTML = '';
        canvasContainer.appendChild(renderer.domElement);
        
        // Positionner la caméra de manière fixe
        camera.position.set(0, 0, scrollConfig.startDistance);
        camera.lookAt(0, 0, 0);
        
        // Créer les particules
        particles = createParticles();
        ({ geometry, positions, sizes, colors, opacities, baseColor } = createParticlesGeometry());
        particlesMaterial = createParticlesMaterial();
        particlesObject = new THREE.Points(geometry, particlesMaterial);
        
        // Créer le groupe de particules et l'initialiser avec la bonne rotation
        particlesGroup = new THREE.Group();
        particlesGroup.add(particlesObject);
        particlesGroup.rotation.x = THREE.MathUtils.degToRad(scrollConfig.startRotationX);
        scene.add(particlesGroup);
        
        // Désactiver les contrôles d'orbite
        controls.enabled = false;
        
        // Initialiser l'animation
        animate();
    } else {
        console.error("Canvas container not found");
    }
}

// Fonction pour mettre à jour la position de la caméra en fonction du scroll
function updateCameraFromScroll() {
    // Obtenir les sections
    const sections = document.querySelectorAll('.airdrop_content');
    if (sections.length < 3) return;
    
    const secondSection = sections[1];
    const thirdSection = sections[2];
    const secondSectionRect = secondSection.getBoundingClientRect();
    const thirdSectionRect = thirdSection.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Calculer la progression du scroll pour la rotation
    let rotationProgress = 1 - (secondSectionRect.top / viewportHeight);
    rotationProgress = Math.max(0, Math.min(1, rotationProgress));
    
    // Calculer la progression du scroll pour la division des cercles
    let splitProgress = 0;
    
    if (thirdSectionRect.top <= viewportHeight) {
        splitProgress = 1 - (thirdSectionRect.top / viewportHeight);
        splitProgress = Math.max(0, Math.min(1, splitProgress));
        
        config.splitAnimation.active = true;
        config.splitAnimation.currentSizeMultiplier = 1.0 - (1.0 - config.splitAnimation.particleScale) * splitProgress;
        config.splitAnimation.otherCirclesOpacity = 1.0 - splitProgress;
    } else {
        config.splitAnimation.active = false;
        config.splitAnimation.currentSizeMultiplier = 1.0;
        config.splitAnimation.otherCirclesOpacity = 1.0;
    }
    
    // Calculer la rotation X actuelle
    let currentRotationX;
    if (splitProgress > 0) {
        // Deuxième mouvement : compléter la rotation jusqu'à 180°
        const remainingRotation = 180 - (scrollConfig.startRotationX - scrollConfig.endRotationX);
        currentRotationX = scrollConfig.endRotationX - (remainingRotation * splitProgress);
        
        // Calculer la distance de la caméra
        const minDistance = scrollConfig.endDistance * 0.5; // Distance minimale (plus proche)
        
        // Calculer la progression du zoom basée uniquement sur la position de la section 2
        const section2Progress = Math.max(0, Math.min(1, 1 - (secondSectionRect.top / viewportHeight)));
        
        // Calculer la distance actuelle en fonction de la progression de la section 2
        const currentDistance = scrollConfig.startDistance + 
                              (scrollConfig.endDistance - scrollConfig.startDistance) * rotationProgress;
        
        // Appliquer le zoom supplémentaire uniquement pendant la section 2
        if (section2Progress < 1) {
            camera.position.z = currentDistance;
        } else {
            // Une fois la section 2 complètement visible, maintenir la distance finale
            camera.position.z = scrollConfig.endDistance;
        }
    } else {
        // Premier mouvement : de 90° à 11°
        currentRotationX = scrollConfig.startRotationX + 
                          (scrollConfig.endRotationX - scrollConfig.startRotationX) * rotationProgress;
        
        // Distance normale pendant la première étape
        const currentDistance = scrollConfig.startDistance + 
                              (scrollConfig.endDistance - scrollConfig.startDistance) * rotationProgress;
        camera.position.z = currentDistance;
    }
    
    // Convertir les degrés en radians et appliquer la rotation
    const angleInRadians = THREE.MathUtils.degToRad(currentRotationX);
    particlesGroup.rotation.x = angleInRadians;
    
    // Mettre à jour l'animation de division
    if (config.splitAnimation.active && splitProgress > 0) {
        updateSplitAnimation(splitProgress);
    } else if (!config.splitAnimation.active) {
        updateSplitAnimation(0);
    }
}

// Fonction pour mettre à jour l'animation de division
function updateSplitAnimation(progress) {
    // Identifier les particules du cercle central (index 1)
    const centralParticles = particles.filter(p => 
        p.isAdditionalCircle && 
        p.additionalCircleIndex === 1
    );
    
    // Si aucune particule ou progress invalide, ne rien faire
    if (centralParticles.length === 0 || progress < 0 || progress > 1) {
        return;
    }
    
    // Si l'animation est désactivée et progress est 0, restaurer les positions d'origine
    if (!config.splitAnimation.active && progress === 0) {
        centralParticles.forEach(particle => {
            if (particle.hasBeenSplit) {
                // Restaurer la position d'origine
                particle.x = particle.originalX;
                particle.y = particle.originalY;
                particle.z = particle.originalZ;
                
                // Restaurer les propriétés
                particle.isAdditionalCircle = true; // Toujours garder cette valeur à true
                particle.hasBeenSplit = false;
                particle.isStatic = true;
                particle.floatSpeed = 0.01 + Math.random() * 0.02;
                particle.floatPhase = Math.random() * Math.PI * 2;
                
                // La taille est maintenant gérée par le multiplicateur global
                
                // Effacer les données d'animation mais maintenir l'activation
                particle.splitStartPosition = null;
                particle.splitTarget = null;
                particle.active = true;
            }
        });
        return;
    }
    
    // Calculer combien de particules par sous-cercle
    const gridSize = config.splitAnimation.gridSize;
    const totalSubCircles = gridSize * gridSize; // 9 sous-cercles
    const particlesPerSubCircle = Math.ceil(centralParticles.length / totalSubCircles);
    
    // Traiter chaque particule
    centralParticles.forEach((particle, index) => {
        // S'assurer que la particule reste active et visible
        particle.active = true;
        particle.isAdditionalCircle = true; // Toujours garder cette valeur à true
        
        // Marquer comme en cours de division
        particle.hasBeenSplit = true;
        
        // Déterminer à quel sous-cercle cette particule appartient
        const subCircleIndex = Math.floor(index / particlesPerSubCircle);
        const row = Math.floor(subCircleIndex / gridSize);
        const col = subCircleIndex % gridSize;
        
        // Sauvegarder la position d'origine si ce n'est pas déjà fait
        if (!particle.originalX) {
            particle.originalX = particle.x;
            particle.originalY = particle.y;
            particle.originalZ = particle.z;
        }
        
        // Sauvegarder la position de départ si nécessaire
        if (!particle.splitStartPosition) {
            particle.splitStartPosition = {
                x: particle.originalX,
                y: particle.originalY,
                z: particle.originalZ
            };
        }
        
        // Calculer la position cible si nécessaire
        if (!particle.splitTarget) {
            // Position du centre du sous-cercle dans la grille 3x3
            const centerX = (col - (gridSize - 1) / 2) * config.splitAnimation.spacing;
            const centerZ = (row - (gridSize - 1) / 2) * config.splitAnimation.spacing;
            
            // Position dans le sous-cercle (distribution circulaire remplie)
            const particleIndexInSubCircle = index % particlesPerSubCircle;
            const angleInSubCircle = (particleIndexInSubCircle / particlesPerSubCircle) * Math.PI * 2;
            
            // Distribution radiale pour remplir le cercle, pas seulement son contour
            const radiusFactor = Math.pow(Math.random(), 0.5) * config.splitAnimation.circleFill;
            const finalRadius = config.splitAnimation.circleRadius * radiusFactor;
            
            // Calculer la position finale avec une forme de cercle rempli
            particle.splitTarget = {
                x: centerX + Math.cos(angleInSubCircle) * finalRadius,
                z: centerZ + Math.sin(angleInSubCircle) * finalRadius
            };
        }
        
        // Appliquer une courbe d'accélération pour une animation plus naturelle
        const easeProgress = progress < 0.5 
            ? 4 * progress * progress * progress  // Accélération plus forte au début
            : 1 - Math.pow(-2 * progress + 2, 3) / 2; // Décélération plus douce à la fin
        
        // Interpoler entre la position de départ et la position cible
        particle.x = particle.splitStartPosition.x * (1 - easeProgress) + particle.splitTarget.x * easeProgress;
        particle.z = particle.splitStartPosition.z * (1 - easeProgress) + particle.splitTarget.z * easeProgress;
        
        // La taille est maintenant gérée par le multiplicateur global dans la fonction animate
        
        // Ajuster progressivement les propriétés statiques
        if (progress > 0.95) {
            // Si l'animation est presque terminée, finaliser l'état
            particle.isStatic = true;
            particle.floatSpeed = 0; // Désactiver le flottement
            particle.floatPhase = 0; // Réinitialiser la phase
        } else {
            // Pendant l'animation, maintenir l'état adéquat
            particle.isStatic = false; // Non statique pendant l'animation pour permettre un mouvement fluide
        }
    });
}

// Classe pour gérer chaque particule
class Particle {
    constructor(index) {
        this.index = index;
        
        // Valeurs par défaut qui seront remplacées lors de la création
        this.isInnerCircle = false;
        this.isAdditionalCircle = false;
        this.additionalCircleIndex = -1;
        this.isStatic = false;
        this.hasBeenSplit = false;
        
        // Propriétés pour le flottement
        this.floatSpeed = 0;
        this.floatPhase = 0;
        
        // Nouvelles propriétés pour l'animation de division
        this.splitProgress = 0;
        this.splitTarget = null;
        this.splitStartPosition = null;
        this.splitEndPosition = null;
        
        // Propriétés pour la transition de taille
        this.sizeTransitionStart = 0;
        this.sizeTransitionTarget = 0;
        this.sizeTransitionProgress = 0;
        this.inSizeTransition = false;
        
        // Propriété d'opacité pour les cercles verticaux
        this.opacity = 1.0;

        this.active = true;
    }
    
    resetParticle() {
        if (this.isInnerCircle || this.isAdditionalCircle) {
            // Position aléatoire dans le cercle 
            const angle = Math.random() * Math.PI * 2;
            const radiusFactor = Math.pow(Math.random(), 0.5) * config.innerCircleFill;
            this.radius = config.innerRadius * radiusFactor;
            
            this.isStatic = true;
            this.angle = angle;
            
            // Position horizontale (commune à tous les cercles)
            this.x = Math.cos(this.angle) * this.radius;
            this.z = Math.sin(this.angle) * this.radius;
            
            // Position verticale (spécifique à chaque cercle)
            if (this.isInnerCircle) {
                // Décaler le cercle principal vers le haut
                this.y = 2 * config.additionalCircleVerticalSpacing;
            } else if (this.isAdditionalCircle) {
                // Ajuster la position des cercles verticaux par rapport au cercle vert (index 1)
                if (this.additionalCircleIndex === 1) {
                    // Le cercle vert au centre
                    this.y = 0;
                } else if (this.additionalCircleIndex === 0) {
                    // Premier cercle blanc au-dessus du vert
                    this.y = config.additionalCircleVerticalSpacing;
                } else {
                    // Les deux cercles blancs en dessous du vert
                    const offset = this.additionalCircleIndex - 1;
                    this.y = -offset * config.additionalCircleVerticalSpacing;
                }
            }
            
            // Taille des particules
            if (this.isInnerCircle) {
                this.size = config.baseParticleSize * (0.7 + Math.random() * 0.6);
            } else if (this.isAdditionalCircle) {
                this.size = config.baseParticleSize * config.additionalCircleParticleScale * (0.7 + Math.random() * 0.6);
            }
            this.currentSize = this.size;
            
            // Pas de direction pour les particules statiques
            this.direction = 0;
            this.distanceTraveled = 0;
            
            // Réinitialiser les positions d'origine
            this.originalX = this.x;
            this.originalY = this.y;
            this.originalZ = this.z;

            // Initialiser le flottement pour les particules non divisées
            if (!this.hasBeenSplit) {
                this.floatSpeed = 0.01 + Math.random() * 0.02;
                this.floatPhase = Math.random() * Math.PI * 2;
            }
        } else {
            // Réinitialiser en tant que particule du cercle extérieur
            this.resetOuterParticle();
        }
    }
    
    // Méthode pour réinitialiser spécifiquement une particule du cercle extérieur
    resetOuterParticle() {
        const angle = Math.random() * Math.PI * 2;
        
        // Déterminer si c'est une particule de bordure et de quel type
        const random = Math.random();
        const isInnerBorder = random < config.innerBorderParticleRatio;
        const isOuterBorder = !isInnerBorder && random < (config.innerBorderParticleRatio + config.outerBorderParticleRatio);
        
        // Définir si la particule est statique ou mobile
        this.isStatic = Math.random() > config.minMobileRatio;
        
        if (isInnerBorder) {
            // Particules de la bordure intérieure
            const randomOffset = (Math.random() - 0.5) * (config.innerBorderWidth * 0.5);
            this.radius = config.outerRadius - config.innerBorderWidth + randomOffset;
            this.size = config.outerCircleBorderParticleSize * (0.8 + Math.random() * 0.4);
        } else if (isOuterBorder) {
            // Particules de la bordure extérieure
            const randomOffset = (Math.random() - 0.5) * (config.outerBorderWidth * 0.5);
            this.radius = config.outerRadius + config.outerBorderWidth + randomOffset;
            this.size = config.outerCircleBorderParticleSize * (0.8 + Math.random() * 0.4);
        } else {
            // Particules normales du cercle extérieur
            this.radius = config.outerRadius;
            this.size = config.outerCircleParticleSize;
        }
        
        this.angle = angle;
        this.speed = (Math.random() * 0.5 + 0.5) * config.particleSpeed;
        this.direction = Math.random() < config.outerOutwardRatio ? 1 : -1;
        
        // Calculer la position directement
        this.x = Math.cos(this.angle) * this.radius;
        this.y = (Math.random() - 0.5) * 0.3; // Légère variation sur Y
        this.z = Math.sin(this.angle) * this.radius;
        
        this.distanceTraveled = 0;
        this.active = true;
        this.currentSize = this.size;
        
        if (!this.hasBeenSplit) {
            this.floatSpeed = 0.01 + Math.random() * 0.02;
            this.floatPhase = Math.random() * Math.PI * 2;
        }
    }
    
    update(deltaTime) {
        if (!this.active) return;

        // Cas spécial pour les particules du cercle central (index 1)
        if (this.isAdditionalCircle && this.additionalCircleIndex === 1) {
            // Ne rien faire ici, la taille est contrôlée par updateSplitAnimation
            return;
        }

        if (this.isStatic) {
            // Ajouter un flottement uniquement aux particules non divisées
            if (!this.hasBeenSplit) {
                this.floatPhase += this.floatSpeed;
                const float = Math.sin(this.floatPhase) * 0.15 + 1;
                this.currentSize = this.size * float;
            }
            return;
        }
        
        // Déplacement des particules du cercle extérieur uniquement
        this.distanceTraveled += this.speed * this.direction;
        
        // Si la particule a atteint sa distance maximale vers l'extérieur, la réinitialiser
        if (this.direction > 0 && this.distanceTraveled > config.maxParticleDistance) {
            this.resetOuterParticle();
            return;
        }
        
        // Calculer la nouvelle position radiale
        const currentRadius = this.radius + this.distanceTraveled;
        
        // Si la particule va vers l'intérieur et atteint le cercle intérieur, la réinitialiser
        if (this.direction < 0 && currentRadius <= config.innerRadius) {
            this.resetOuterParticle();
            return;
        }
        
        // Mettre à jour la position
        this.x = Math.cos(this.angle) * currentRadius;
        this.z = Math.sin(this.angle) * currentRadius;
        
        // Petite oscillation verticale pendant le mouvement
        this.y += (Math.random() - 0.5) * 0.01;
        this.y *= 0.98; // Amortissement pour éviter une trop grande dispersion
        
        // Facteur de taille basé sur la distance parcourue
        const distanceFactor = 1.0 - (Math.abs(this.distanceTraveled) / config.maxParticleDistance) * config.fadeWithDistance;
        this.currentSize = this.size * distanceFactor;
    }
}

// Créer la géométrie pour les particules
function createParticlesGeometry() {
    const totalParticles = config.innerCircleParticles + 
                         (config.additionalCircles * config.additionalCircleParticles) + 
                         config.outerCircleParticles;
    
    // Allocation des tableaux de données pour chaque particule
    const positions = new Float32Array(totalParticles * 3); // xyz pour chaque point
    const sizes = new Float32Array(totalParticles);
    const colors = new Float32Array(totalParticles * 3); // rgb pour chaque point
    const opacities = new Float32Array(totalParticles); // opacité pour chaque point
    
    // Initialiser avec des valeurs par défaut
    for (let i = 0; i < totalParticles; i++) {
        const idx = i * 3;
        // Position par défaut
        positions[idx] = 0;
        positions[idx + 1] = 0;
        positions[idx + 2] = 0;
        // Taille par défaut
        sizes[i] = config.baseParticleSize;
        // Couleur par défaut (va être remplacée dans la fonction animate)
        const color = new THREE.Color(config.particleColor);
        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;
        // Opacité par défaut
        opacities[i] = 1.0;
    }
    
    // Préparation des couleurs de base pour utilisation dans l'animation
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

// Créer le matériau pour les particules
function createParticlesMaterial() {
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
                
                // Calcul de distance à la caméra
                float distanceToCamera = distance(position, cameraPos);
                
                // Ajustement de la taille en fonction de la profondeur
                float scaleFactor = 1.0 - (distanceToCamera * ${config.perspectiveEffect.toFixed(2)}) / 10.0;
                float adjustedSize = size * max(scaleFactor, 0.3);
                
                // Projection standard
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = adjustedSize * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vOpacity;
            
            void main() {
                // Calcul de la distance au centre du point
                vec2 center = vec2(0.5, 0.5);
                float dist = length(gl_PointCoord - center);
                
                // Réduire encore plus la taille du cercle visible
                float threshold = 0.25; // Valeur encore plus petite pour réduire davantage la taille des cercles
                
                // Création d'un point lumineux plus petit avec une transition plus nette
                float alpha = 1.0 - smoothstep(threshold, threshold + 0.03, dist);
                
                // Assombrir légèrement les bords pour atténuer l'effet de cercle vert
                if (dist > threshold) {
                    alpha *= 0.4; // Réduire l'opacité dans la zone de transition
                }
                
                // Couleur finale avec opacité contrôlée
                gl_FragColor = vec4(vColor, alpha * vOpacity);
                
                // Rejeter les fragments au-delà du seuil pour une coupure nette
                if (dist > threshold + 0.03) discard;
            }
        `,
        transparent: true,
        depthTest: true,
        depthWrite: false
    });
}

// Créer un tableau de particules
function createParticles() {
    const particles = [];
    let index = 0;
    
    // Créer les particules pour le cercle intérieur
    for (let i = 0; i < config.innerCircleParticles; i++) {
        const particle = new Particle(index++);
        particle.isInnerCircle = true;
        particle.isAdditionalCircle = false;
        particle.additionalCircleIndex = -1;
        particle.isStatic = true;
        particle.resetParticle();
        particles.push(particle);
    }
    
    // Créer les particules pour les cercles supplémentaires
    for (let circleIndex = 0; circleIndex < config.additionalCircles; circleIndex++) {
        for (let i = 0; i < config.additionalCircleParticles; i++) {
            const particle = new Particle(index++);
            particle.isInnerCircle = false;
            particle.isAdditionalCircle = true;
            particle.additionalCircleIndex = circleIndex;
            particle.isStatic = true;
            particle.resetParticle();
            particles.push(particle);
        }
    }
    
    // Créer les particules pour le cercle extérieur
    let staticCount = 0;
    let mobileCount = 0;
    const targetMobileRatio = 0.4;
    
    for (let i = 0; i < config.outerCircleParticles; i++) {
        const particle = new Particle(index++);
        particle.isInnerCircle = false;
        particle.isAdditionalCircle = false;
        particle.additionalCircleIndex = -1;
        
        const currentMobileRatio = mobileCount / (staticCount + mobileCount + 1);
        if (currentMobileRatio < targetMobileRatio) {
            particle.isStatic = false;
            mobileCount++;
        } else {
            particle.isStatic = Math.random() > targetMobileRatio;
            if (particle.isStatic) staticCount++;
            else mobileCount++;
        }
        
        particle.resetParticle();
        particles.push(particle);
    }
    
    // Log du nombre de particules par type
    const centralCircleParticles = particles.filter(p => 
        p.isAdditionalCircle && p.additionalCircleIndex === 2
    ).length;
    
    console.log(`Statistiques des particules:
    - Total: ${particles.length}
    - Cercle central (index 2): ${centralCircleParticles}
    - Position Y du cercle central: ${-2 * config.additionalCircleVerticalSpacing}`);
    
    return particles;
}

// Version alternative sans créer de cercles guides
function createGuideCircles() {
    // Créer un groupe vide (aucun cercle guide n'est créé)
    return new THREE.Group();
}

let guideCircles = createGuideCircles();
scene.add(guideCircles);

// Redimensionnement de la fenêtre
// Fonction pour ajuster la taille du renderer à celle du conteneur
function updateRendererSize() {
    const container = document.querySelector('.airdrop_left');
    if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    } else {
        // Fallback au cas où le conteneur n'est pas trouvé
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
    }
}

window.addEventListener('resize', updateRendererSize);

// Fonction pour mettre à jour les indicateurs de caméra
function updateCameraInfo() {
    // Obtenir les éléments DOM pour les indicateurs
    const rotationXElement = document.getElementById('rotation-x');
    const rotationYElement = document.getElementById('rotation-y');
    const rotationZElement = document.getElementById('rotation-z');
    const distanceElement = document.getElementById('camera-distance');
    
    // Calculer la distance entre la caméra et le centre de la scène
    const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    
    // Obtenir les sections pour déterminer le progrès de défilement
    const sections = document.querySelectorAll('.airdrop_content');
    let scrollProgress = 0;
    
    if (sections.length >= 2) {
        const secondSection = sections[1];
        const secondSectionRect = secondSection.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // Calculer la progression du scroll (0 à 1)
        scrollProgress = 1 - (secondSectionRect.top / viewportHeight);
        scrollProgress = Math.max(0, Math.min(1, scrollProgress));
    }
    
    // Interpolation linéaire simple entre les valeurs de début et de fin pour X
    const rotX = scrollConfig.startRotationX + 
                (scrollConfig.endRotationX - scrollConfig.startRotationX) * scrollProgress;
    
    // Mettre à jour les indicateurs avec des valeurs fixes pour Y et Z
    if (rotationXElement && rotationYElement && rotationZElement && distanceElement) {
        rotationXElement.textContent = rotX.toFixed(2);
        rotationYElement.textContent = "0.00";
        rotationZElement.textContent = "-180.00"; // Z reste constant
        distanceElement.textContent = distance.toFixed(2);
    }
}

// Animation
let frameCount = 0; // Compteur de frames pour diagnostic

// Variable pour suivre si l'utilisateur a commencé à défiler
let hasScrolled = false;

function animate() {
    requestAnimationFrame(animate);
    
    // Mettre à jour la position de la caméra en fonction du scroll uniquement si l'utilisateur a défilé
    if (hasScrolled) {
        updateCameraFromScroll();
    }
    
    // Compteur de particules pour diagnostic
    let inactiveCount = 0;
    let innerCount = 0;
    let additionalCount = 0;
    let outerCount = 0;
    let movingCount = 0;
    let centralCircleCount = 0; // Compteur pour le cercle central (index 1)
    
    // Créer des couleurs THREE.js à partir des valeurs hexadécimales
    const mainColor = new THREE.Color(config.particleColor);
    const splitColor = new THREE.Color(config.splitCircleColor);
    
    // Mise à jour des particules
    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        
        // Ne jamais désactiver les particules du cercle central (index 1)
        if (particle.isAdditionalCircle && particle.additionalCircleIndex === 1) {
            particle.active = true;
            centralCircleCount++;
            
            // Appliquer le multiplicateur de taille global pour les particules du cercle central
            // Cela permet une transition fluide de la taille liée directement au scroll
            particle.currentSize = particle.size * config.splitAnimation.currentSizeMultiplier;
        }
        
        // Gérer l'opacité des cercles verticaux et du cercle principal (en haut)
        if (particle.isAdditionalCircle || particle.isInnerCircle) {
            // Le cercle qui se scinde (index 1) reste toujours visible
            if (particle.isAdditionalCircle && particle.additionalCircleIndex === 1) {
                particle.active = true;
                particle.opacity = 1.0; // Toujours complètement visible
            } 
            // Tous les autres cercles (y compris le cercle principal et les autres verticaux) deviennent progressivement transparents
            else {
                // Si l'opacité est presque nulle, désactiver complètement la particule
                if (config.splitAnimation.otherCirclesOpacity < 0.05) {
                    particle.active = false;
                } else {
                    particle.active = true;
                    
                    // Appliquer l'opacité actuelle basée sur le scroll
                    particle.opacity = config.splitAnimation.otherCirclesOpacity;
                }
            }
        }
        
        // Ne mettre à jour que les particules non statiques et actives
        if (!particle.isStatic && particle.active) {
            particle.update(0.016); // Environ 60 FPS
        }
        
        // Compter les types de particules pour diagnostic
        if (!particle.active) inactiveCount++;
        if (particle.isInnerCircle) innerCount++;
        if (particle.isAdditionalCircle) additionalCount++;
        if (!particle.isInnerCircle && !particle.isAdditionalCircle) outerCount++;
        if (!particle.isStatic) movingCount++;
        
        // Mettre à jour la position dans le buffer UNIQUEMENT si la particule est active
        // OU si elle appartient au cercle central (pour garantir sa visibilité)
        if (particle.active || (particle.isAdditionalCircle && particle.additionalCircleIndex === 1)) {
            const idx = i * 3;
            positions[idx] = particle.x;
            positions[idx + 1] = particle.y;
            positions[idx + 2] = particle.z;
            
            // Mettre à jour la taille
            sizes[i] = particle.currentSize;
            
            // Mettre à jour la couleur - utiliser la couleur verte pour le cercle qui se scinde
            if ((particle.isAdditionalCircle && particle.additionalCircleIndex === 1) || particle.hasBeenSplit) {
                // Appliquer la couleur verte au cercle qui se scinde et aux particules divisées
                colors[idx] = splitColor.r;
                colors[idx + 1] = splitColor.g;
                colors[idx + 2] = splitColor.b;
            } else {
                // Utiliser la couleur principale pour les autres particules
                colors[idx] = mainColor.r;
                colors[idx + 1] = mainColor.g;
                colors[idx + 2] = mainColor.b;
            }
            
            // Mettre à jour l'opacité
            opacities[i] = particle.opacity !== undefined ? particle.opacity : 1.0;
        } else {
            // Pour les particules inactives, les déplacer hors de la vue
            const idx = i * 3;
            positions[idx] = 0;
            positions[idx + 1] = -1000; // Très loin en dessous
            positions[idx + 2] = 0;
            sizes[i] = 0; // Taille nulle
            opacities[i] = 0; // Opacité nulle
        }
    }
    
    // Log de diagnostic pour le cercle central (toutes les 120 frames)
    if (frameCount % 120 === 0) {
        console.log(`Particules du cercle central (index 1): ${centralCircleCount}, actives: ${centralCircleCount - inactiveCount}`);
    }
    
    // AJOUT: Vérifier si le nombre de particules mobiles est trop bas
    // et forcer la réinitialisation de certaines particules statiques en particules mobiles
    const minMobileParticles = Math.floor(config.outerCircleParticles * config.minMobileRatio);
    
    // Ne vérifier que si on est sous le seuil et pas trop fréquemment (tous les 10 frames)
    if (movingCount < minMobileParticles && frameCount % 10 === 0) {
        // Calculer le nombre exact de particules à convertir
        const particlesToConvert = Math.min(50, minMobileParticles - movingCount);
        
        // Réinitialiser certaines particules du cercle extérieur pour les rendre mobiles
        let resetCount = 0;
        
        // Calcul de l'index de début des particules du cercle extérieur
        const outerCircleStartIndex = config.innerCircleParticles + (config.additionalCircles * config.additionalCircleParticles);
        
        for (let i = outerCircleStartIndex; i < particles.length && resetCount < particlesToConvert; i++) {
            if (particles[i].isStatic) {
                // Forcer cette particule statique du cercle extérieur à devenir mobile
                particles[i].isStatic = false;
                
                // Favoriser les particules allant vers l'intérieur pour maintenir le flux
                particles[i].direction = Math.random() < 0.7 ? -1 : 1;
                
                // Varier les vitesses pour un mouvement plus naturel
                particles[i].speed = config.particleSpeed * (0.7 + Math.random() * 0.6);
                
                // Réinitialiser la distance parcourue
                particles[i].distanceTraveled = 0;
                
                resetCount++;
            }
        }
    }
    
    // Mise à jour de la géométrie des particules
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.opacity.needsUpdate = true;
    
    // Mise à jour des indicateurs de caméra
    updateCameraInfo();
    
    renderer.render(scene, camera);
    
    // Incrémenter le compteur de frames
    frameCount++;
}

// Initialiser les contrôles UI après le chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM chargé, initialisation...");
    
    // Mettre à jour la taille lors du chargement
    updateRendererSize();
    
    // Initialiser la scène
    init();
    
    // Ajouter un écouteur d'événement pour le défilement
    window.addEventListener('scroll', () => {
        // Marquer que l'utilisateur a commencé à défiler
        hasScrolled = true;
        // Mettre à jour la position de la caméra en fonction du défilement
        requestAnimationFrame(updateCameraFromScroll);
    });
    
    // Initialiser les contrôles
    setupControls();
    setupCameraInfoToggle();
});

// Gestion des contrôles UI
function setupControls() {
    const controlsPanel = document.getElementById('controls');
    const hideControlsBtn = document.getElementById('hideControls');
    let controlsVisible = true;

    // Configuration des contrôles
    const setupControl = (id, property, min, max, step) => {
        const slider = document.getElementById(id);
        const valueDisplay = document.getElementById(`${id}Value`);
        
        if (!slider || !valueDisplay) {
            console.error(`Contrôle non trouvé pour ${id}`);
            return;
        }
        
        // Initialiser avec la valeur actuelle
        slider.value = config[property];
        valueDisplay.textContent = config[property].toFixed(2);
        
        // Mettre à jour quand le slider change
        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            config[property] = value;
            valueDisplay.textContent = value.toFixed(2);
            
            // Pour le nombre de particules, recréer les particules
            if (['innerCircleParticles', 'outerCircleParticles'].includes(property)) {
                if (property === 'innerCircleParticles') {
                    config.additionalCircleParticles = value;
                }
                recreateParticles();
            }
            
            // Appliquer les changements selon le paramètre
            if (['innerRadius', 'outerRadius', 'additionalCircleVerticalSpacing'].includes(property)) {
                // Réinitialiser uniquement les particules, les cercles guides n'existent plus
                for (let i = 0; i < particles.length; i++) {
                    particles[i].resetParticle();
                }
            }
            
            // Pour certains paramètres, réinitialiser les particules
            if (['staticRingWidth', 'outerOutwardRatio', 'innerCircleFill', 'outerCircleParticleSize'].includes(property)) {
                for (let i = 0; i < particles.length; i++) {
                    particles[i].resetParticle();
                }
            }
            
            // Pour la perspective, recréer le matériau
            if (property === 'perspectiveEffect') {
                scene.remove(particlesObject);
                particlesMaterial = createParticlesMaterial();
                particlesObject = new THREE.Points(geometry, particlesMaterial);
                particlesGroup.add(particlesObject);
            }
            
            // Pour la taille des particules
            if (property === 'baseParticleSize') {
                for (let i = 0; i < particles.length; i++) {
                    particles[i].size = value * (0.7 + Math.random() * 0.6);
                }
            }
        });
    };

    // Fonction pour recréer le système de particules
    function recreateParticles() {
        console.log("Recréation des particules...");
        
        particles = createParticles();
        
        scene.remove(particlesObject);
        ({ geometry, positions, sizes, colors, opacities, baseColor } = createParticlesGeometry());
        particlesMaterial = createParticlesMaterial();
        particlesObject = new THREE.Points(geometry, particlesMaterial);
        particlesGroup.add(particlesObject);
    }

    // Gestion du bouton pour masquer/afficher les contrôles
    if (hideControlsBtn) {
        hideControlsBtn.addEventListener('click', () => {
            if (controlsVisible) {
                controlsPanel.style.right = '-270px';
                hideControlsBtn.textContent = 'Afficher';
            } else {
                controlsPanel.style.right = '10px';
                hideControlsBtn.textContent = 'Masquer';
            }
            controlsVisible = !controlsVisible;
        });
    }
    
    // Configuration des contrôles spécifiques
    setupControl('innerRadius', 'innerRadius', 0.5, 4, 0.1);
    setupControl('outerRadius', 'outerRadius', 3, 10, 0.1);
    setupControl('innerCircleParticles', 'innerCircleParticles', 100, 1000, 50);
    setupControl('outerCircleParticles', 'outerCircleParticles', 100, 2000, 50);
    setupControl('baseParticleSize', 'baseParticleSize', 0.1, 1, 0.05);
    setupControl('outerCircleParticleSize', 'outerCircleParticleSize', 0.1, 1, 0.05);
    setupControl('outerCircleBorderParticleSize', 'outerCircleBorderParticleSize', 0.1, 1, 0.05);
    setupControl('innerBorderWidth', 'innerBorderWidth', 0.1, 1, 0.05);
    setupControl('outerBorderWidth', 'outerBorderWidth', 0.1, 1, 0.05);
    setupControl('innerBorderParticleRatio', 'innerBorderParticleRatio', 0.05, 0.3, 0.05);
    setupControl('outerBorderParticleRatio', 'outerBorderParticleRatio', 0.05, 0.3, 0.05);
    setupControl('maxParticleDistance', 'maxParticleDistance', 0.5, 5, 0.1);
    setupControl('particleSpeed', 'particleSpeed', 0.005, 0.05, 0.001);
    setupControl('fadeWithDistance', 'fadeWithDistance', 0, 1, 0.05);
    setupControl('innerCircleFill', 'innerCircleFill', 0, 1, 0.05);
    setupControl('staticRingWidth', 'staticRingWidth', 0, 1, 0.05);
    setupControl('outerOutwardRatio', 'outerOutwardRatio', 0, 1, 0.05);
    setupControl('perspectiveEffect', 'perspectiveEffect', 0, 1, 0.05);
    setupControl('minMobileRatio', 'minMobileRatio', 0.1, 0.7, 0.05);
    setupControl('additionalCircleVerticalSpacing', 'additionalCircleVerticalSpacing', 0.2, 1.5, 0.1);
}

// Gestion du bouton pour afficher/masquer les indicateurs de caméra
function setupCameraInfoToggle() {
    const cameraInfoPanel = document.getElementById('camera-info');
    const toggleButton = document.getElementById('toggleCameraInfo');
    let infoVisible = true;
    
    if (toggleButton && cameraInfoPanel) {
        toggleButton.addEventListener('click', () => {
            if (infoVisible) {
                const children = cameraInfoPanel.children;
                for (let i = 0; i < children.length; i++) {
                    if (children[i] !== toggleButton) {
                        children[i].style.display = 'none';
                    }
                }
                cameraInfoPanel.style.padding = '5px';
                toggleButton.textContent = 'Afficher';
            } else {
                const children = cameraInfoPanel.children;
                for (let i = 0; i < children.length; i++) {
                    children[i].style.display = '';
                }
                cameraInfoPanel.style.padding = '10px';
                toggleButton.textContent = 'Masquer';
            }
            infoVisible = !infoVisible;
        });
    }
}