import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Center, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { audioManager } from '../services/audioService';

interface GameSceneProps {
  errors: number;
  isCorrect: boolean;
  isWrong: boolean;
  isWon: boolean;
  isLost: boolean;
}

// --- CONSTANTS ---
const HAT_COLOR = "#8B4513";
const SKIN_COLOR = "#FFD1AA";
const SHIRT_COLOR = "#FFD700"; // Yellow shirt like Woody
const VEST_COLOR = "#FFFFFF";  // Cow pattern base
const JEANS_COLOR = "#1E3F5A";
const BOOTS_COLOR = "#3E2723";

// --- CAMERA CONTROLLER ---
const CameraController = ({ isZoomed }: { isZoomed: boolean }) => {
  const { camera } = useThree();
  // Default position
  const targetPos = useRef(new THREE.Vector3(0, 1.5, 6));
  const lookAtTarget = useRef(new THREE.Vector3(0, 1, 0));

  useEffect(() => {
    if (isZoomed) {
      // Zoom closer and HIGHER to focus on the face/hat, not the chest
      targetPos.current.set(0, 2.9, 2.2); 
      lookAtTarget.current.set(0, 2.7, 0); // Look at head level
    } else {
      // Default view
      targetPos.current.set(0, 1.5, 6);
      lookAtTarget.current.set(0, 1, 0); // Look at center
    }
  }, [isZoomed]);

  useFrame((state, delta) => {
    // Increased speed (from 3 to 8) for snappier reaction
    const speed = 8 * delta;
    
    state.camera.position.lerp(targetPos.current, speed);
    
    const controls = state.controls as any;
    if (controls) {
      controls.target.lerp(lookAtTarget.current, speed);
      controls.update();
    }
  });

  return null;
};

// --- SUB-COMPONENTS ---

const Face = ({ expression }: { expression: 'happy' | 'angry' | 'scared' | 'dead' | 'neutral' }) => {
  const leftEyePos = new THREE.Vector3(-0.12, 0.08, 0.28); 
  const rightEyePos = new THREE.Vector3(0.12, 0.08, 0.28);

  let browRot = 0;
  let mouthScaleY = 1;
  let mouthScaleX = 1;
  let mouthY = -0.15;
  let isDead = expression === 'dead';

  switch (expression) {
    case 'angry': browRot = -0.3; break; 
    case 'scared': browRot = 0.4; mouthScaleY = 2; mouthScaleX = 0.5; break; 
    case 'happy': browRot = 0; mouthY = -0.10; break; 
    case 'dead': browRot = 0; break;
    default: browRot = 0;
  }

  return (
    <group>
      {/* Eyes */}
      {!isDead ? (
        <>
          <mesh position={leftEyePos} castShadow>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="white" />
          </mesh>
          <mesh position={rightEyePos} castShadow>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="white" />
          </mesh>
          <mesh position={[leftEyePos.x, leftEyePos.y, leftEyePos.z + 0.05]}>
            <sphereGeometry args={[0.025, 16, 16]} />
            <meshStandardMaterial color="black" />
          </mesh>
          <mesh position={[rightEyePos.x, rightEyePos.y, rightEyePos.z + 0.05]}>
            <sphereGeometry args={[0.025, 16, 16]} />
            <meshStandardMaterial color="black" />
          </mesh>
        </>
      ) : (
        <>
          <group position={leftEyePos}>
             <mesh rotation={[0,0,Math.PI/4]}><boxGeometry args={[0.1, 0.02, 0.02]} /><meshBasicMaterial color="black"/></mesh>
             <mesh rotation={[0,0,-Math.PI/4]}><boxGeometry args={[0.1, 0.02, 0.02]} /><meshBasicMaterial color="black"/></mesh>
          </group>
          <group position={rightEyePos}>
             <mesh rotation={[0,0,Math.PI/4]}><boxGeometry args={[0.1, 0.02, 0.02]} /><meshBasicMaterial color="black"/></mesh>
             <mesh rotation={[0,0,-Math.PI/4]}><boxGeometry args={[0.1, 0.02, 0.02]} /><meshBasicMaterial color="black"/></mesh>
          </group>
        </>
      )}

      {/* Brows */}
      <mesh position={[-0.12, 0.18, 0.26]} rotation={[0, 0, browRot]} castShadow>
        <boxGeometry args={[0.12, 0.03, 0.05]} />
        <meshStandardMaterial color="#3E2723" />
      </mesh>
      <mesh position={[0.12, 0.18, 0.26]} rotation={[0, 0, -browRot]} castShadow>
        <boxGeometry args={[0.12, 0.03, 0.05]} />
        <meshStandardMaterial color="#3E2723" />
      </mesh>

      {/* Mouth */}
      <group position={[0, mouthY, 0.28]} scale={[mouthScaleX, mouthScaleY, 1]}>
        {expression === 'happy' ? (
           <mesh rotation={[Math.PI, 0, 0]}>
             <torusGeometry args={[0.08, 0.02, 8, 16, Math.PI]} />
             <meshStandardMaterial color="#5D4037" />
           </mesh>
        ) : expression === 'scared' ? (
           <mesh>
             <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} rotation={[Math.PI/2, 0, 0]} />
             <meshStandardMaterial color="#3E2723" />
           </mesh>
        ) : (
           expression === 'angry' ? (
             <mesh rotation={[0,0,0]}>
                <torusGeometry args={[0.06, 0.02, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#5D4037" />
             </mesh>
           ) : (
            <mesh>
              <boxGeometry args={[0.15, 0.02, 0.02]} />
              <meshStandardMaterial color="#5D4037" />
            </mesh>
           )
        )}
      </group>
    </group>
  );
};

// A "Manga/Toy Story" 3D Cowboy
const Cowboy = ({ errors, isCorrect, isWrong, isWon, isLost }: GameSceneProps) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Body parts refs for animation
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  
  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.3 }), []);
  const shirtMat = useMemo(() => new THREE.MeshStandardMaterial({ color: SHIRT_COLOR }), []);
  const jeansMat = useMemo(() => new THREE.MeshStandardMaterial({ color: JEANS_COLOR }), []);
  const bootsMat = useMemo(() => new THREE.MeshStandardMaterial({ color: BOOTS_COLOR }), []);
  const hatMat = useMemo(() => new THREE.MeshStandardMaterial({ color: HAT_COLOR }), []);
  const vestMat = useMemo(() => new THREE.MeshStandardMaterial({ color: VEST_COLOR }), []);

  let expression: 'happy' | 'angry' | 'scared' | 'dead' | 'neutral' = 'neutral';
  if (isLost) expression = 'dead';
  else if (isWon || isCorrect) expression = 'happy';
  else if (isWrong) {
    if (errors > 4) expression = 'scared';
    else expression = 'angry';
  } else {
    if (errors > 4) expression = 'scared';
    else expression = 'neutral';
  }

  // Trigger movement sounds on state change
  useEffect(() => {
    if (isCorrect || isWrong) {
      audioManager.playSwoosh();
    }
  }, [isCorrect, isWrong]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    const speed = 5 * delta; // Interpolation speed

    // --- MAIN BODY ANIMATION ---
    let targetRotY = 0;
    let targetPosY = 2.4;
    let targetRotZ = 0;

    if (isLost) {
      // Dead swing
      targetRotZ = Math.sin(time) * 0.1;
      targetRotY = Math.sin(time * 0.5) * 0.2;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0.2, speed);
    } else if (isWon) {
      // Happy Jump/Bob
      targetRotY = Math.sin(time * 5) * 0.5;
      targetPosY = 2.4 + Math.abs(Math.sin(time * 10)) * 0.1;
    } else if (isCorrect) {
      // Excited Wiggle
      targetRotY = Math.sin(time * 15) * 0.2;
      targetPosY = 2.4 + Math.sin(time * 20) * 0.05;
    } else if (isWrong) {
      // Shake Head/Body
      const intensity = errors > 3 ? 0.2 : 0.05;
      groupRef.current.position.x = Math.sin(time * 50) * intensity;
    } else {
      // Idle breathing
      targetRotZ = Math.sin(time * 1.5) * 0.03;
      groupRef.current.position.x = 0;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, speed);
    }

    // Apply Main Body Lerps
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotZ, speed);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, speed);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetPosY, speed);


    // --- ARMS ANIMATION (SIMPLIFIED: HANGING T-POSE-ISH) ---
    // Arms are dead weight, they just sway with the body or breathe slightly.
    
    // Default hanging pose: WIDER STANCE (Cross/T-Pose style) to prevent clipping
    // Z = 1.2 radians is almost horizontal (T-Pose is PI/2 = 1.57)
    let laRot = { x: 0, y: 0, z: 1.2 }; 
    let raRot = { x: 0, y: 0, z: -1.2 };
    let lfaRot = { z: 0.2 }; 
    let rfaRot = { z: -0.2 };

    if (isLost) {
      // Dead: completely limp, down
      laRot.z = 0.2;
      raRot.z = -0.2;
      laRot.x = 0.1; 
      raRot.x = 0.1;
      lfaRot.z = 0.1;
      rfaRot.z = -0.1;
    } else if (isWon) {
       // VICTORY V
       laRot.z = 2.5; // Up
       raRot.z = -2.5; // Up
       laRot.y = 0.5;
       raRot.y = -0.5;
    } else if (isCorrect) {
      // Excited flap
      laRot.z = 1.2 + Math.sin(time * 15) * 0.2; 
      raRot.z = -1.2 - Math.sin(time * 15) * 0.2;
    } else if (expression === 'scared' || expression === 'angry' || isWrong) {
       // Stiff T-Pose Jitter
       laRot.z = 1.3;
       raRot.z = -1.3;
       // Jitter
       laRot.y = Math.sin(time * 40) * 0.1;
       raRot.y = -Math.sin(time * 40) * 0.1;
    } else {
      // Idle: Breathing animation - Arms hang comfortably wide (T-Pose / Scarecrow)
      laRot.z = 1.1 + Math.sin(time * 2) * 0.05;
      raRot.z = -1.1 - Math.sin(time * 2) * 0.05;
    }

    // Apply Arm Rotations with Lerp
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, laRot.x || 0, speed);
      leftArmRef.current.rotation.y = THREE.MathUtils.lerp(leftArmRef.current.rotation.y, laRot.y || 0, speed);
      leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, laRot.z, speed);
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, raRot.x || 0, speed);
      rightArmRef.current.rotation.y = THREE.MathUtils.lerp(rightArmRef.current.rotation.y, raRot.y || 0, speed);
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, raRot.z, speed);
    }
    // Apply Forearm Rotations
    if (leftForearmRef.current) {
       leftForearmRef.current.rotation.z = THREE.MathUtils.lerp(leftForearmRef.current.rotation.z, lfaRot.z, speed);
    }
    if (rightForearmRef.current) {
       rightForearmRef.current.rotation.z = THREE.MathUtils.lerp(rightForearmRef.current.rotation.z, rfaRot.z, speed);
    }
  });

  return (
    <group ref={groupRef} position={[0, 2.4, 0]}>
      
      {/* 1. HEAD (Attached to neck pivot) */}
      {errors >= 1 && (
        <group position={[0, 0.1, 0]}> 
          {/* Head Box */}
          <mesh material={skinMat} castShadow>
             <boxGeometry args={[0.5, 0.6, 0.55]} /> 
          </mesh>
          <Face expression={expression} />
          {/* Hat */}
          <group position={[0, 0.35, 0]} rotation={[-0.1, 0, 0]}>
            <mesh material={hatMat} castShadow receiveShadow>
               <cylinderGeometry args={[0.8, 0.8, 0.05, 32]} />
            </mesh>
            <mesh position={[0, 0.25, 0]} material={hatMat} castShadow>
               <cylinderGeometry args={[0.4, 0.5, 0.5, 32]} />
            </mesh>
             <mesh position={[0, 0.05, 0]} material={shirtMat}>
               <cylinderGeometry args={[0.41, 0.51, 0.1, 32]} />
            </mesh>
          </group>
          {/* Neck */}
          <mesh position={[0, -0.35, 0]} material={skinMat}>
            <cylinderGeometry args={[0.15, 0.15, 0.2]} />
          </mesh>
        </group>
      )}

      {/* 2. TORSO (Below neck) */}
      {errors >= 2 && (
        <group position={[0, -0.6, 0]}> {/* Adjusted to connect to neck */}
          <mesh material={shirtMat} castShadow>
            <boxGeometry args={[0.5, 0.7, 0.35]} />
          </mesh>
          {/* Vest parts */}
          <mesh material={vestMat} position={[-0.26, 0, 0.02]} castShadow>
             <boxGeometry args={[0.05, 0.72, 0.37]} />
          </mesh>
          <mesh material={vestMat} position={[0.26, 0, 0.02]} castShadow>
             <boxGeometry args={[0.05, 0.72, 0.37]} />
          </mesh>
          {/* Belt */}
          <mesh material={new THREE.MeshStandardMaterial({ color: "#3E2723" })} position={[0, -0.35, 0]}>
             <boxGeometry args={[0.52, 0.15, 0.38]} />
          </mesh>
          {/* Buckle */}
          <mesh material={new THREE.MeshStandardMaterial({ color: "gold" })} position={[0, -0.35, 0.2]}>
             <boxGeometry args={[0.15, 0.12, 0.05]} />
          </mesh>

          {/* 3. ARMS - SIMPLIFIED HANGING */}
          {/* LEFT ARM */}
          {errors >= 3 && (
            // Pivot Point moved OUTWARDS (x: -0.38)
            <group ref={leftArmRef} position={[-0.38, 0.2, 0]}> 
                {/* Upper Arm - moves down from pivot */}
                <mesh material={shirtMat} position={[0, -0.25, 0]}>
                   <cylinderGeometry args={[0.09, 0.08, 0.5]} />
                </mesh>
                {/* Forearm - Pivot at Elbow */}
                <group ref={leftForearmRef} position={[0, -0.5, 0]}>
                      <mesh material={skinMat} position={[0, -0.25, 0]}>
                         <cylinderGeometry args={[0.08, 0.06, 0.5]} />
                      </mesh>
                      <mesh material={skinMat} position={[0, -0.5, 0]}>
                        <sphereGeometry args={[0.1]} />
                      </mesh>
                </group>
            </group>
          )}

          {/* RIGHT ARM */}
          {errors >= 4 && (
             // Pivot Point moved OUTWARDS (x: 0.38)
            <group ref={rightArmRef} position={[0.38, 0.2, 0]}> 
                <mesh material={shirtMat} position={[0, -0.25, 0]}>
                   <cylinderGeometry args={[0.09, 0.08, 0.5]} />
                </mesh>
                <group ref={rightForearmRef} position={[0, -0.5, 0]}>
                      <mesh material={skinMat} position={[0, -0.25, 0]}>
                         <cylinderGeometry args={[0.08, 0.06, 0.5]} />
                      </mesh>
                      <mesh material={skinMat} position={[0, -0.5, 0]}>
                        <sphereGeometry args={[0.1]} />
                      </mesh>
                </group>
            </group>
          )}

          {/* 4. LEGS - PARENTED TO TORSO */}
          {/* LEFT LEG */}
          {errors >= 5 && (
             <group position={[-0.15, -0.4, 0]}> {/* Pivot at Hip */}
                <group rotation={[expression === 'scared' ? -0.5 : 0, 0, 0]}>
                   <mesh material={jeansMat} position={[0, -0.35, 0]}>
                     <cylinderGeometry args={[0.11, 0.09, 0.7]} />
                   </mesh>
                   {/* Boot */}
                   <group position={[0, -0.7, 0]}>
                     <mesh material={bootsMat} position={[0, -0.15, 0.05]}>
                       <boxGeometry args={[0.14, 0.3, 0.18]} />
                     </mesh>
                     <mesh material={bootsMat} position={[0, -0.3, 0.15]}>
                        <boxGeometry args={[0.14, 0.1, 0.25]} />
                     </mesh>
                   </group>
                </group>
             </group>
          )}

          {/* RIGHT LEG */}
          {errors >= 6 && (
             <group position={[0.15, -0.4, 0]}> {/* Pivot at Hip */}
                <group rotation={[expression === 'scared' ? 0.5 : 0, 0, 0]}>
                   <mesh material={jeansMat} position={[0, -0.35, 0]}>
                     <cylinderGeometry args={[0.11, 0.09, 0.7]} />
                   </mesh>
                   <group position={[0, -0.7, 0]}>
                     <mesh material={bootsMat} position={[0, -0.15, 0.05]}>
                       <boxGeometry args={[0.14, 0.3, 0.18]} />
                     </mesh>
                     <mesh material={bootsMat} position={[0, -0.3, 0.15]}>
                        <boxGeometry args={[0.14, 0.1, 0.25]} />
                     </mesh>
                   </group>
                </group>
             </group>
          )}

        </group>
      )}

    </group>
  );
};

const Gallows = () => {
  const woodMaterial = new THREE.MeshStandardMaterial({ color: "#5C4033", roughness: 0.9 });
  return (
    <group position={[0, -1, 0]}>
      <mesh position={[0, 0, 0]} material={woodMaterial} receiveShadow><cylinderGeometry args={[2, 2.2, 0.2, 6]} /></mesh>
      <mesh position={[-1.2, 2.5, 0]} material={woodMaterial} castShadow><boxGeometry args={[0.4, 5, 0.4]} /></mesh>
      <mesh position={[0, 4.8, 0]} material={woodMaterial} castShadow><boxGeometry args={[3, 0.3, 0.3]} /></mesh>
      <mesh position={[-0.8, 4, 0]} rotation={[0, 0, Math.PI / 4]} material={woodMaterial}><boxGeometry args={[1, 0.2, 0.2]} /></mesh>
      <mesh position={[0, 3.6, 0]}><cylinderGeometry args={[0.04, 0.04, 2.4]} /><meshStandardMaterial color="#D2B48C" /></mesh>
      <mesh position={[0, 2.45, 0.15]} rotation={[0.2,0,0]}><torusGeometry args={[0.08, 0.03, 8, 16]} /><meshStandardMaterial color="#D2B48C" /></mesh>
    </group>
  );
};

export const GameScene: React.FC<GameSceneProps> = (props) => {
  const isZoomed = props.isCorrect || props.isWrong || props.isWon || props.isLost;

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden shadow-inner bg-gradient-to-b from-sky-300 via-blue-100 to-orange-50 border-4 border-amber-900/20">
      <Canvas shadows camera={{ position: [0, 1.5, 6], fov: 45 }}>
        <CameraController isZoomed={isZoomed} />
        <ambientLight intensity={0.8} />
        <spotLight position={[5, 8, 5]} angle={0.4} penumbra={0.5} intensity={1.5} castShadow shadow-bias={-0.0001} />
        <directionalLight position={[-5, 5, -2]} intensity={0.5} color="#ffd700" />
        <Center>
          <Gallows />
          <Cowboy {...props} />
        </Center>
        <ContactShadows position={[0, -1, 0]} opacity={0.5} scale={10} blur={2} far={4} />
        <Environment preset="park" />
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.8} minAzimuthAngle={-Math.PI / 4} maxAzimuthAngle={Math.PI / 4}/>
      </Canvas>
    </div>
  );
};