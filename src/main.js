import * as THREE from "three";
import confetti from "canvas-confetti";
import { gsap } from "gsap";

const config = {
  colors: [0xffa500, 0x4169e1, 0xff6347, 0x32cd32, 0x00ced1],
  boxCount: 15,
  spread: 4,
};
const PICK_BOX_COUNT = 15;

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
const sorryPopup = document.getElementById("stage-sorry");

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
  window.addEventListener("pointerdown", onMouseClick, { passive: true });

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

function createGameBoxes(count = config.boxCount) {
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

  const geometry = new THREE.IcosahedronGeometry(2, 0);
  const logoTexture = new THREE.TextureLoader().load("/logo.svg");

  for (let i = 0; i < count; i++) {
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

    const spacing = 3.5;
    const xPos = (i - (count - 1) / 2) * spacing;
    mesh.position.set(xPos, 0, 0);

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
    // const response = await fetch("../src/data.json", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     name: document.getElementById("name").value,
    //     agreementNumber: document.getElementById("Agreement-Number").value,
    //   }),
    // });
    const params = new URLSearchParams({
      name: document.getElementById("name").value,
      agreement_no: document.getElementById("Agreement-Number").value,
    });
    const response = await fetch(`../src/data.json?${params.toString()}`);
    const data = await response.json();
    console.log(data);
    // console.log(data.voucher);

    if (data == 0) {
      gameState = "Sorry";
    } else {
      document.getElementById("coupon-code").innerText = data.voucher;
      
    }
    const formName = document.getElementById("name").value;
    const formAgreementNumber =
      document.getElementById("Agreement-Number").value;
    console.log(formName, formAgreementNumber);
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

    // createGameBoxes();
    createGameBoxes(15);
    camera.position.z = 22;
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

  setTimeout(() => {
    if (gameState == "Sorry") {
      sorryPopup.classList.remove("hidden-vis");
      sorryPopup.classList.add("visible-vis");
    } else {
      secondConfetti();
      document.getElementById("confetti").classList.remove("hideConfetti")
      // setTimeout(() => {
      //   triggerConfetti();
      // }, 500);
      uiResult.classList.remove("hidden-vis");
      uiResult.classList.add("visible-vis");

      const interval = setInterval(() => {
        secondConfetti();
      }, 2000);

      setTimeout(() => {
        clearInterval(interval);
      }, 60000);
    }
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

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children, true);
  const box = intersects.find(
    (hit) => hit.object.geometry?.type === "IcosahedronGeometry"
  );

  if (box) {
    handleBoxClick(box.object);
  }
}

function checkIntersection() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
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
        b.x + Math.sin(time * 0.8 + off * 0.2) * 4 + Math.sin(time * 0.1) * 0.2;

      m.position.y =
        b.y + Math.cos(time * 0.5 + off * 0.3) * 4 + Math.sin(time * 0.15) * 2;

      m.position.z = b.z + Math.sin(time * 0.22 + off * 0.2) * 6;

      const rotMultiplier = m.userData.isSelected ? 0.03 : 0.3;

      m.rotation.x += box.rotSpeed.x * rotMultiplier * 12;
      m.rotation.y += box.rotSpeed.y * rotMultiplier * 12;
      m.rotation.z += box.rotSpeed.z * rotMultiplier * 12;
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


var retina = window.devicePixelRatio,

// Math shorthands
PI = Math.PI,
sqrt = Math.sqrt,
round = Math.round,
random = Math.random,
cos = Math.cos,
sin = Math.sin,

// Local WindowAnimationTiming interface
rAF = window.requestAnimationFrame,
cAF = window.cancelAnimationFrame || window.cancelRequestAnimationFrame,
_now = Date.now || function () {return new Date().getTime();};



document.addEventListener("DOMContentLoaded", function() {
var speed = 50,
  duration = (1.0 / speed),
  confettiRibbonCount = 11,
  ribbonPaperCount = 10,
  ribbonPaperDist = 8.0,
  ribbonPaperThick = 8.0,
  confettiPaperCount = 95,
  DEG_TO_RAD = PI / 180,
  RAD_TO_DEG = 180 / PI,
  colors = [
    ["#df0049", "#660671"],
    ["#00e857", "#005291"],
    ["#2bebbc", "#05798a"],
    ["#ffd200", "#b06c00"]
  ];

function Vector2(_x, _y) {
this.x = _x, this.y = _y;
this.Length = function() {
  return sqrt(this.SqrLength());
}
this.SqrLength = function() {
  return this.x * this.x + this.y * this.y;
}
this.Add = function(_vec) {
  this.x += _vec.x;
  this.y += _vec.y;
}
this.Sub = function(_vec) {
  this.x -= _vec.x;
  this.y -= _vec.y;
}
this.Div = function(_f) {
  this.x /= _f;
  this.y /= _f;
}
this.Mul = function(_f) {
  this.x *= _f;
  this.y *= _f;
}
this.Normalize = function() {
  var sqrLen = this.SqrLength();
  if (sqrLen != 0) {
    var factor = 1.0 / sqrt(sqrLen);
    this.x *= factor;
    this.y *= factor;
  }
}
this.Normalized = function() {
  var sqrLen = this.SqrLength();
  if (sqrLen != 0) {
    var factor = 1.0 / sqrt(sqrLen);
    return new Vector2(this.x * factor, this.y * factor);
  }
  return new Vector2(0, 0);
}
}
Vector2.Lerp = function(_vec0, _vec1, _t) {
return new Vector2((_vec1.x - _vec0.x) * _t + _vec0.x, (_vec1.y - _vec0.y) * _t + _vec0.y);
}
Vector2.Distance = function(_vec0, _vec1) {
return sqrt(Vector2.SqrDistance(_vec0, _vec1));
}
Vector2.SqrDistance = function(_vec0, _vec1) {
var x = _vec0.x - _vec1.x;
var y = _vec0.y - _vec1.y;
return (x * x + y * y + z * z);
}
Vector2.Scale = function(_vec0, _vec1) {
return new Vector2(_vec0.x * _vec1.x, _vec0.y * _vec1.y);
}
Vector2.Min = function(_vec0, _vec1) {
return new Vector2(Math.min(_vec0.x, _vec1.x), Math.min(_vec0.y, _vec1.y));
}
Vector2.Max = function(_vec0, _vec1) {
return new Vector2(Math.max(_vec0.x, _vec1.x), Math.max(_vec0.y, _vec1.y));
}
Vector2.ClampMagnitude = function(_vec0, _len) {
var vecNorm = _vec0.Normalized;
return new Vector2(vecNorm.x * _len, vecNorm.y * _len);
}
Vector2.Sub = function(_vec0, _vec1) {
return new Vector2(_vec0.x - _vec1.x, _vec0.y - _vec1.y, _vec0.z - _vec1.z);
}

function EulerMass(_x, _y, _mass, _drag) {
this.position = new Vector2(_x, _y);
this.mass = _mass;
this.drag = _drag;
this.force = new Vector2(0, 0);
this.velocity = new Vector2(0, 0);
this.AddForce = function(_f) {
  this.force.Add(_f);
}
this.Integrate = function(_dt) {
  var acc = this.CurrentForce(this.position);
  acc.Div(this.mass);
  var posDelta = new Vector2(this.velocity.x, this.velocity.y);
  posDelta.Mul(_dt);
  this.position.Add(posDelta);
  acc.Mul(_dt);
  this.velocity.Add(acc);
  this.force = new Vector2(0, 0);
}
this.CurrentForce = function(_pos, _vel) {
  var totalForce = new Vector2(this.force.x, this.force.y);
  var speed = this.velocity.Length();
  var dragVel = new Vector2(this.velocity.x, this.velocity.y);
  dragVel.Mul(this.drag * this.mass * speed);
  totalForce.Sub(dragVel);
  return totalForce;
}
}

function ConfettiPaper(_x, _y) {
this.pos = new Vector2(_x, _y);
this.rotationSpeed = (random() * 600 + 800);
this.angle = DEG_TO_RAD * random() * 360;
this.rotation = DEG_TO_RAD * random() * 360;
this.cosA = 1.0;
this.size = 5.0;
this.oscillationSpeed = (random() * 1.5 + 0.5);
this.xSpeed = 40.0;
this.ySpeed = (random() * 60 + 50.0);
this.corners = new Array();
this.time = random();
var ci = round(random() * (colors.length - 1));
this.frontColor = colors[ci][0];
this.backColor = colors[ci][1];
for (var i = 0; i < 4; i++) {
  var dx = cos(this.angle + DEG_TO_RAD * (i * 90 + 45));
  var dy = sin(this.angle + DEG_TO_RAD * (i * 90 + 45));
  this.corners[i] = new Vector2(dx, dy);
}
this.Update = function(_dt) {
  this.time += _dt;
  this.rotation += this.rotationSpeed * _dt;
  this.cosA = cos(DEG_TO_RAD * this.rotation);
  this.pos.x += cos(this.time * this.oscillationSpeed) * this.xSpeed * _dt
  this.pos.y += this.ySpeed * _dt;
  if (this.pos.y > ConfettiPaper.bounds.y) {
    this.pos.x = random() * ConfettiPaper.bounds.x;
    this.pos.y = 0;
  }
}
this.Draw = function(_g) {
  if (this.cosA > 0) {
    _g.fillStyle = this.frontColor;
  } else {
    _g.fillStyle = this.backColor;
  }
  _g.beginPath();
  _g.moveTo((this.pos.x + this.corners[0].x * this.size) * retina, (this.pos.y + this.corners[0].y * this.size * this.cosA) * retina);
  for (var i = 1; i < 4; i++) {
    _g.lineTo((this.pos.x + this.corners[i].x * this.size) * retina, (this.pos.y + this.corners[i].y * this.size * this.cosA) * retina);
  }
  _g.closePath();
  _g.fill();
}
}
ConfettiPaper.bounds = new Vector2(0, 0);

function ConfettiRibbon(_x, _y, _count, _dist, _thickness, _angle, _mass, _drag) {
this.particleDist = _dist;
this.particleCount = _count;
this.particleMass = _mass;
this.particleDrag = _drag;
this.particles = new Array();
var ci = round(random() * (colors.length - 1));
this.frontColor = colors[ci][0];
this.backColor = colors[ci][1];
this.xOff = (cos(DEG_TO_RAD * _angle) * _thickness);
this.yOff = (sin(DEG_TO_RAD * _angle) * _thickness);
this.position = new Vector2(_x, _y);
this.prevPosition = new Vector2(_x, _y);
this.velocityInherit = (random() * 2 + 4);
this.time = random() * 100;
this.oscillationSpeed = (random() * 2 + 2);
this.oscillationDistance = (random() * 40 + 40);
this.ySpeed = (random() * 40 + 80);
for (var i = 0; i < this.particleCount; i++) {
  this.particles[i] = new EulerMass(_x, _y - i * this.particleDist, this.particleMass, this.particleDrag);
}
this.Update = function(_dt) {
  var i = 0;
  this.time += _dt * this.oscillationSpeed;
  this.position.y += this.ySpeed * _dt;
  this.position.x += cos(this.time) * this.oscillationDistance * _dt;
  this.particles[0].position = this.position;
  var dX = this.prevPosition.x - this.position.x;
  var dY = this.prevPosition.y - this.position.y;
  var delta = sqrt(dX * dX + dY * dY);
  this.prevPosition = new Vector2(this.position.x, this.position.y);
  for (i = 1; i < this.particleCount; i++) {
    var dirP = Vector2.Sub(this.particles[i - 1].position, this.particles[i].position);
    dirP.Normalize();
    dirP.Mul((delta / _dt) * this.velocityInherit);
    this.particles[i].AddForce(dirP);
  }
  for (i = 1; i < this.particleCount; i++) {
    this.particles[i].Integrate(_dt);
  }
  for (i = 1; i < this.particleCount; i++) {
    var rp2 = new Vector2(this.particles[i].position.x, this.particles[i].position.y);
    rp2.Sub(this.particles[i - 1].position);
    rp2.Normalize();
    rp2.Mul(this.particleDist);
    rp2.Add(this.particles[i - 1].position);
    this.particles[i].position = rp2;
  }
  if (this.position.y > ConfettiRibbon.bounds.y + this.particleDist * this.particleCount) {
    this.Reset();
  }
}
this.Reset = function() {
  this.position.y = -random() * ConfettiRibbon.bounds.y;
  this.position.x = random() * ConfettiRibbon.bounds.x;
  this.prevPosition = new Vector2(this.position.x, this.position.y);
  this.velocityInherit = random() * 2 + 4;
  this.time = random() * 100;
  this.oscillationSpeed = random() * 2.0 + 1.5;
  this.oscillationDistance = (random() * 40 + 40);
  this.ySpeed = random() * 40 + 80;
  var ci = round(random() * (colors.length - 1));
  this.frontColor = colors[ci][0];
  this.backColor = colors[ci][1];
  this.particles = new Array();
  for (var i = 0; i < this.particleCount; i++) {
    this.particles[i] = new EulerMass(this.position.x, this.position.y - i * this.particleDist, this.particleMass, this.particleDrag);
  }
}
this.Draw = function(_g) {
  for (var i = 0; i < this.particleCount - 1; i++) {
    var p0 = new Vector2(this.particles[i].position.x + this.xOff, this.particles[i].position.y + this.yOff);
    var p1 = new Vector2(this.particles[i + 1].position.x + this.xOff, this.particles[i + 1].position.y + this.yOff);
    if (this.Side(this.particles[i].position.x, this.particles[i].position.y, this.particles[i + 1].position.x, this.particles[i + 1].position.y, p1.x, p1.y) < 0) {
      _g.fillStyle = this.frontColor;
      _g.strokeStyle = this.frontColor;
    } else {
      _g.fillStyle = this.backColor;
      _g.strokeStyle = this.backColor;
    }
    if (i == 0) {
      _g.beginPath();
      _g.moveTo(this.particles[i].position.x * retina, this.particles[i].position.y * retina);
      _g.lineTo(this.particles[i + 1].position.x * retina, this.particles[i + 1].position.y * retina);
      _g.lineTo(((this.particles[i + 1].position.x + p1.x) * 0.5) * retina, ((this.particles[i + 1].position.y + p1.y) * 0.5) * retina);
      _g.closePath();
      _g.stroke();
      _g.fill();
      _g.beginPath();
      _g.moveTo(p1.x * retina, p1.y * retina);
      _g.lineTo(p0.x * retina, p0.y * retina);
      _g.lineTo(((this.particles[i + 1].position.x + p1.x) * 0.5) * retina, ((this.particles[i + 1].position.y + p1.y) * 0.5) * retina);
      _g.closePath();
      _g.stroke();
      _g.fill();
    } else if (i == this.particleCount - 2) {
      _g.beginPath();
      _g.moveTo(this.particles[i].position.x * retina, this.particles[i].position.y * retina);
      _g.lineTo(this.particles[i + 1].position.x * retina, this.particles[i + 1].position.y * retina);
      _g.lineTo(((this.particles[i].position.x + p0.x) * 0.5) * retina, ((this.particles[i].position.y + p0.y) * 0.5) * retina);
      _g.closePath();
      _g.stroke();
      _g.fill();
      _g.beginPath();
      _g.moveTo(p1.x * retina, p1.y * retina);
      _g.lineTo(p0.x * retina, p0.y * retina);
      _g.lineTo(((this.particles[i].position.x + p0.x) * 0.5) * retina, ((this.particles[i].position.y + p0.y) * 0.5) * retina);
      _g.closePath();
      _g.stroke();
      _g.fill();
    } else {
      _g.beginPath();
      _g.moveTo(this.particles[i].position.x * retina, this.particles[i].position.y * retina);
      _g.lineTo(this.particles[i + 1].position.x * retina, this.particles[i + 1].position.y * retina);
      _g.lineTo(p1.x * retina, p1.y * retina);
      _g.lineTo(p0.x * retina, p0.y * retina);
      _g.closePath();
      _g.stroke();
      _g.fill();
    }
  }
}
this.Side = function(x1, y1, x2, y2, x3, y3) {
  return ((x1 - x2) * (y3 - y2) - (y1 - y2) * (x3 - x2));
}
}
ConfettiRibbon.bounds = new Vector2(0, 0);
confetti = {};
confetti.Context = function(id) {
var i = 0;
var canvas = document.getElementById(id);
var canvasParent = canvas.parentNode;
var canvasWidth = canvasParent.offsetWidth;
var canvasHeight = canvasParent.offsetHeight;
canvas.width = canvasWidth * retina;
canvas.height = canvasHeight * retina;
var context = canvas.getContext('2d');
var interval = null;
var confettiRibbons = new Array();
ConfettiRibbon.bounds = new Vector2(canvasWidth, canvasHeight);
for (i = 0; i < confettiRibbonCount; i++) {
  confettiRibbons[i] = new ConfettiRibbon(random() * canvasWidth, -random() * canvasHeight * 2, ribbonPaperCount, ribbonPaperDist, ribbonPaperThick, 45, 1, 0.05);
}
var confettiPapers = new Array();
ConfettiPaper.bounds = new Vector2(canvasWidth, canvasHeight);
for (i = 0; i < confettiPaperCount; i++) {
  confettiPapers[i] = new ConfettiPaper(random() * canvasWidth, random() * canvasHeight);
}
this.resize = function() {
  canvasWidth = canvasParent.offsetWidth;
  canvasHeight = canvasParent.offsetHeight;
  canvas.width = canvasWidth * retina;
  canvas.height = canvasHeight * retina;
  ConfettiPaper.bounds = new Vector2(canvasWidth, canvasHeight);
  ConfettiRibbon.bounds = new Vector2(canvasWidth, canvasHeight);
}
this.start = function() {
  this.stop()
  var context = this;
  this.update();
}
this.stop = function() {
  cAF(this.interval);
}
this.update = function() {
  var i = 0;
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (i = 0; i < confettiPaperCount; i++) {
    confettiPapers[i].Update(duration);
    confettiPapers[i].Draw(context);
  }
  for (i = 0; i < confettiRibbonCount; i++) {
    confettiRibbons[i].Update(duration);
    confettiRibbons[i].Draw(context);
  }
  this.interval = rAF(function() {
    confetti.update();
  });
}
}
var confetti = new confetti.Context('confetti');
confetti.start();
window.addEventListener('resize', function(event){
confetti.resize();
});
});
   