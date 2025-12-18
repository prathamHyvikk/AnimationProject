import * as THREE from "three";
import confetti from "canvas-confetti";
import { gsap } from "gsap";

const config = {
  colors: [0xffa500, 0x4169e1, 0xff6347, 0x32cd32, 0x00ced1],
  boxCount: 50,
  spread: 4,
};
let scene, camera, renderer, raycaster, mouse;
let boxes = [];
let particles = [];
let isHovering = false;
let selectedBox = null;
let gameState = "FORM";
let time = 0;

const uiForm = document.getElementById("stage-form");
const uiPick = document.getElementById("stage-pick");
const uiResult = document.getElementById("stage-result");
const formEl = document.getElementById("details-form");

function init() {
  scene = new THREE.Scene();

  scene.fog = new THREE.Fog(0xe0f2fe, 10, 50);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 15;

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById("canvas-container").appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // const backLight = new THREE.PointLight(0xffd700, 0.5);
  // backLight.position.set(-5, -5, -5);
  // scene.add(backLight);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  createBackgroundMeshes();

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("click", onMouseClick);

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    transitionToPickPhase();
  });
}

function createBackgroundMeshes() {
  const geometry = new THREE.IcosahedronGeometry(3, 0);
  const logoTexture = new THREE.TextureLoader().load("/logo.svg");

  function createFloatingMesh(materialColor, position, speed = 0.006) {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: materialColor,
        flatShading: true,
      })
    );

    mesh.position.set(position.x, position.y, position.z);
    mesh.userData.basePosition = mesh.position.clone();

    mesh.floatData = {
      offset: Math.random() * 100,
      baseScale: 1,
      rangeX: 6 + Math.random() * 4,
      rangeY: 4 + Math.random() * 3,
      rangeZ: 3 + Math.random() * 2,
    };

    function addLogoToFace(faceIndex) {
      const logoGeo = new THREE.PlaneGeometry(0.8, 0.8);
      const logoMat = new THREE.MeshBasicMaterial({
        map: logoTexture,
        transparent: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const logoMesh = new THREE.Mesh(logoGeo, logoMat);

      const posAttribute = mesh.geometry.getAttribute("position");
      const localNormal = new THREE.Vector3();

      const vA = new THREE.Vector3().fromBufferAttribute(
        posAttribute,
        faceIndex * 3
      );
      const vB = new THREE.Vector3().fromBufferAttribute(
        posAttribute,
        faceIndex * 3 + 1
      );
      const vC = new THREE.Vector3().fromBufferAttribute(
        posAttribute,
        faceIndex * 3 + 2
      );
      const center = new THREE.Vector3()
        .add(vA)
        .add(vB)
        .add(vC)
        .divideScalar(3);

      logoMesh.position.copy(center);

      const normal = center.clone().normalize();
      const targetPosition = center.clone().add(normal);
      logoMesh.lookAt(targetPosition);
      mesh.add(logoMesh);
    }

    addLogoToFace(0);
    addLogoToFace(10);

    addLogoToFace(18);
    scene.add(mesh);
    boxes.push({ mesh, type: "bg", speed });

    return mesh;
  }

  createFloatingMesh("#4C6EF5", { x: -15, y: -6, z: -5 });

  // createFloatingMesh("#9B5DE5", { x: 14, y: 7, z: -8 });
  createFloatingMesh("#A8E063", { x: -17, y: 7, z: -8 });
  createFloatingMesh("#FF8FA3", { x: 11, y: 7, z: -8 });
  createFloatingMesh("#FFD166", { x: 10, y: -5, z: -6 });
  if (window.innerWidth < 800) {
    createFloatingMesh("#8E8AFF", { x: -1, y: -4, z: -5 });
    createFloatingMesh("#2EC4B6", { x: 0, y: 5, z: -8 });
  }

  // createFloatingMesh("#76E4F7", { x: 10, y: 0, z: -5 });
}

function createGameBoxes() {
  boxes.forEach((item) => {
    gsap.to(item.mesh.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.5,
      onComplete: () => scene.remove(item.mesh),
    });

    item.mesh.userData.basePosition = item.mesh.position.clone();
  });
  boxes = [];

  const geometry = new THREE.IcosahedronGeometry(1.7, 0);
  const logoTexture = new THREE.TextureLoader().load("/logo.svg");

  for (let i = 0; i < config.boxCount; i++) {
    const color = config.colors[i % config.colors.length];
    const material = new THREE.MeshStandardMaterial({
      color: color,

      emissive: color,
      emissiveIntensity: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);

    function addLogoToFace(faceIndex) {
      const logoGeo = new THREE.PlaneGeometry(0.5, 0.5);
      const logoMat = new THREE.MeshBasicMaterial({
        map: logoTexture,
        transparent: true,
        side: THREE.DoubleSide,
        polygonOffset: true, // Prevents "Z-fighting" (flickering)
        polygonOffsetFactor: -1,
      });
      const logoMesh = new THREE.Mesh(logoGeo, logoMat);
      // 1. Get the center position of a specific triangular face
      const posAttribute = mesh.geometry.getAttribute("position");
      const localNormal = new THREE.Vector3();
      // Calculate the face normal and center
      const vA = new THREE.Vector3().fromBufferAttribute(
        posAttribute,
        faceIndex * 3
      );
      const vB = new THREE.Vector3().fromBufferAttribute(
        posAttribute,
        faceIndex * 3 + 1
      );
      const vC = new THREE.Vector3().fromBufferAttribute(
        posAttribute,
        faceIndex * 3 + 2
      );
      const center = new THREE.Vector3()
        .add(vA)
        .add(vB)
        .add(vC)
        .divideScalar(3);
      // 2. Position the logo at the face center
      logoMesh.position.copy(center);
      // 3. Make the logo look away from the center of the icosahedron
      // For a centered icosahedron, the normal is just the normalized center point
      const normal = center.clone().normalize();
      const targetPosition = center.clone().add(normal);
      logoMesh.lookAt(targetPosition);
      mesh.add(logoMesh);
    }

    addLogoToFace(0);
    addLogoToFace(10);

    addLogoToFace(18);

    const xPos = (i - 2) * 5;

    mesh.position.set(xPos, 0, 0);

    mesh.userData.basePosition = mesh.position.clone();
    mesh.userData.id = i;
    mesh.userData.originalColor = color;

    scene.add(mesh);

    boxes.push({
      mesh: mesh,
      type: "game",
      floatOffset: Math.random() * 100,
      floatSpeed: 1 + Math.random(),
      rotSpeed: {
        x: Math.random() * 0.02,
        y: Math.random() * 0.02,
        z: Math.random() * 0.02,
      },
    });
  }
}

async function fetchVoucher() {
  try {
    const response = await fetch("../src/data.json");
    const data = await response.json();
    console.log(data.voucher);
    document.getElementById("coupon-code").innerText = data.voucher;
  } catch (error) {
    console.error(error);
  }
}

// Game Logic

function transitionToPickPhase() {
  gameState = "PICK";

  uiForm.classList.add("fade-out");

  setTimeout(() => {
    uiForm.style.display = "none";

    uiPick.classList.remove("hidden-vis");
    uiPick.classList.add("visible-vis");

    createGameBoxes();
  }, 500);
}

function handleBoxClick(intersectedMesh) {
  if (gameState !== "PICK") return;
  gameState = "REVEALING";
  selectedBox = intersectedMesh;
  fetchVoucher();

  uiPick.classList.remove("visible-vis");
  uiPick.classList.add("hidden-vis");

  boxes.forEach((item) => {
    if (item.mesh !== selectedBox) {
      gsap.to(item.mesh.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.5,
        ease: "back.in(1)",
      });
      gsap.to(item.mesh.position, {
        y: item.mesh.position.y - 2,
        duration: 0.5,
      });
    }
  });

  gsap.to(selectedBox.position, {
    x: 0,
    y: 0,
    z: 5,
    duration: 1,
    ease: "power2.inOut",
  });
  gsap.to(selectedBox.rotation, {
    x: 0,
    y: 0,
    z: 0,
    repeat: 20,
    duration: 0.05,
  });

  //  SHAKE Animation
  const tl = gsap.timeline({
    onComplete: explodeBox,
  });

  tl.to(selectedBox.position, { duration: 1 }, "+=0")
    .to(selectedBox.position, {
      x: "+=0.2",
      y: "+=0.2",
      yoyo: true,
      repeat: 8,
      duration: 0.05,
    })
    .to(
      selectedBox.scale,
      {
        x: 1.4,
        y: 1.4,
        z: 1.4,
        duration: 0.07,
        ease: "power1.in",
      },
      "<"
    )
    .to(
      selectedBox.material,
      {
        emissiveIntensity: 2,
        duration: 0.03,
      },
      "<"
    );
}

function explodeBox() {
  selectedBox.visible = false;

  triggerConfetti();

  setInterval(() => {
    secondConfetti();
  }, 2000);

  setTimeout(() => {
    uiResult.classList.remove("hidden-vis");
    uiResult.classList.add("visible-vis");

    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    // document.getElementById("coupon-code").innerText = `XXXX`;
  }, 200);
}

function triggerConfetti() {
  var duration = 60 * 1000;
  var animationEnd = Date.now() + duration;
  var defaults = {
    scalar: 2,
    startVelocity: 30,
    spread: 360,
    ticks: 200,
    zIndex: 0,
  };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  var interval = setInterval(function () {
    var timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    var particleCount = 50 * (timeLeft / duration);
    // since particles fall down, start a bit higher than random
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    });
  }, 250);
}

function secondConfetti() {
  var count = 200;
  var defaults = {
    origin: { y: 0.7 },
    scalar: 2,
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });
  fire(0.2, {
    spread: 60,
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (gameState === "PICK") {
    checkIntersection();
  }
}

function onMouseClick(event) {
  if (gameState !== "PICK") return;

  if (gameState === "PICK" && isHovering) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);
    const box = intersects.find(
      (hit) => hit.object.geometry.type === "IcosahedronGeometry"
    );
    if (box) {
      handleBoxClick(box.object);
    }
  }
}

function checkIntersection() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children);
  // selectedBox.userData.isSelected = true;

  const hit = intersects.find(
    (i) => i.object.geometry.type === "IcosahedronGeometry"
  );

  if (hit) {
    document.body.style.cursor = "pointer";
    isHovering = true;

    if (!hit.object.userData.isHovered) {
      gsap.to(hit.object.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 0.3 });
      hit.object.userData.isHovered = true;
    }
  } else {
    document.body.style.cursor = "default";
    isHovering = false;

    boxes.forEach((b) => {
      if (b.type === "game" && b.mesh.userData.isHovered) {
        gsap.to(b.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
        b.mesh.userData.isHovered = false;
      }
    });
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.render(scene, camera);
  onWindowResize();

  time += 0.01;

  const t = performance.now() * 0.001;

  boxes.forEach((box) => {
    const mesh = box.mesh;
    if (mesh === selectedBox) return;

    if (box.type === "bg") {
      const m = box.mesh;
      const b = m.userData.basePosition;
      const f = m.floatData;
      const off = f.offset;

      m.position.x =
        b.x + Math.sin(time * 0.25 + off * 0.2) * 4 + Math.sin(time * 0.1) * 8;

      m.position.y =
        b.y +
        Math.cos(time * 0.5 + off * 0.3) * 1 +
        Math.sin(time * 0.15) * 0.2;

      m.position.z = b.z + Math.sin(time * 0.22 + off * 0.2) * 2;

      const s = f.baseScale + Math.sin(time * 1.2 + off) * 0.12;
      m.scale.set(s, s, s);

      m.rotation.x += box.speed;
      m.rotation.y += box.speed * 1.1;
    }

    if (box.type === "game") {
      const m = box.mesh;
      const b = m.userData.basePosition;
      const off = box.floatOffset;

      m.position.x =
        b.x + Math.sin(time * 0.8 + off * 0.2) * 4 + Math.sin(time * 0.1) * 2;

      m.position.y =
        b.y + Math.cos(time * 0.5 + off * 0.3) * 4 + Math.sin(time * 0.15) * 2;

      m.position.z = b.z + Math.sin(time * 0.22 + off * 0.2) * 6;

      const rotMultiplier = m.userData.isSelected ? 0.03 : 0.3;

      m.rotation.x += box.rotSpeed.x * rotMultiplier;
      m.rotation.y += box.rotSpeed.y * rotMultiplier;
      m.rotation.z += box.rotSpeed.z * rotMultiplier;
    }
  });

  if (particles.length > 0) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.position.add(p.userData.velocity);
      p.rotation.x += 0.1;
      p.rotation.y += 0.1;
      p.scale.multiplyScalar(0.95);

      if (p.scale.x < 0.01) {
        scene.remove(p);
        particles.splice(i, 1);
      }
    }
  }
}

// Run
init();
renderer.setAnimationLoop(animate);
