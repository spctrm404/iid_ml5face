const IDX_LIP_UPPER = 36;
const IDX_LIP_LOWER = 26;
const IDX_NOSE = 2;
const PITCH_COMPENSATION_DEGREES = -35;

let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };
let selIdx = 0;

function preload() {
  // Load the faceMesh model
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  createCanvas(640, 480);
  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  // Start detecting faces from the webcam video
  faceMesh.detectStart(video, gotFaces);
}

function draw() {
  push(); // 기존 변환 상태 저장
  translate(video.width, 0); // 캔버스 오른쪽 끝으로 이동
  scale(-1, 1); // 수평으로 뒤집기
  image(video, 0, 0, width, height);
  pop(); // 변환 상태 복원

  // Draw all the tracked face points
  // for (let i = 0; i < faces.length; i++) {
  //   let face = faces[i];
  //   for (let j = 0; j < face.keypoints.length; j++) {
  //     let keypoint = face.keypoints[j];
  //     fill(0, 255, 0);
  //     noStroke();
  //     circle(keypoint.x, keypoint.y, 2);
  //   }
  // }
  faces.forEach((face) => {
    const faceTrianglePoints = getFaceTrianglePoints(face);
    const dirVector = getDirectionVector(faceTrianglePoints);

    const eyesDist = getEyesDist(face);
    const lipsDist = getLipsDist(face);
    if (selIdx >= face.keypoints.length) selIdx = face.keypoints.length - 1;
    const selectedKeypoint = face.keypoints[selIdx];

    stroke(0, 255, 0);
    line(
      width * 0.5,
      height * 0.5,
      width * 0.5 + dirVector.normal.x * 100,
      height * 0.5 + dirVector.normal.y * 100
    );
    drawFacebox(face.box);
    drawKeypointsEnds(face.leftEye);
    drawKeypointsEnds(face.rightEye);
    drawKeypointsEnds(face.leftEyebrow);
    drawKeypointsEnds(face.rightEyebrow);
    drawKeypointsMilestones(face.lips);
    drawBox(face.lips);
    noStroke();
    fill(0);
    text(`eyesDist: ${eyesDist.toFixed(2)}`, 16, 16);
    text(`pitch: ${degrees(dirVector.pitch).toFixed(2)}`, 16, 32);
    text(`yaw: ${degrees(dirVector.yaw).toFixed(2)}`, 16, 48);
    text(`roll: ${degrees(dirVector.roll).toFixed(2)}`, 16, 64);
    text(`lipsDist: ${lipsDist.toFixed(2)}`, 16, 80);
    fill(0, 255, 255);
    text(`lipsDist / eyesDist: ${(lipsDist / eyesDist).toFixed(2)}`, 16, 96);
    fill(0, 255, 255);
    circle(selectedKeypoint.x, selectedKeypoint.y, 5);

    let weight = 50;
    let normalizedLips = lipsDist / eyesDist;
    push();
    rectMode(CENTER);
    noStroke();
    fill(0, 255, 0);
    rect(width - 150, height - 150, 300, 300);

    fill(255);
    rect(
      width - 150,
      height - 150,
      300 - weight * normalizedLips,
      300 - weight * normalizedLips
    );
    pop();
  });
}

function getEyesDist(face) {
  const leftEye = face.leftEye;
  const rightEye = face.rightEye;
  const lastKpLeftEye = leftEye.keypoints[leftEye.keypoints.length - 1];
  const lastKpRightEye = rightEye.keypoints[rightEye.keypoints.length - 1];
  const eyesDist = dist(
    lastKpLeftEye.x,
    lastKpLeftEye.y,
    lastKpLeftEye.z,
    lastKpRightEye.x,
    lastKpRightEye.y,
    lastKpRightEye.z
  );
  return eyesDist;
}

function getFaceTrianglePoints(face) {
  const leftEye = face.leftEye;
  const rightEye = face.rightEye;
  const lastKpLeftEye = leftEye.keypoints[leftEye.keypoints.length - 1];
  const lastKpRightEye = rightEye.keypoints[rightEye.keypoints.length - 1];
  const noseKeypoint = face.keypoints[IDX_NOSE];
  return {
    eyeL: lastKpLeftEye,
    eyeR: lastKpRightEye,
    nose: noseKeypoint,
  };
}

function getLipsDist(face) {
  return dist(
    face.lips.keypoints[IDX_LIP_UPPER].x,
    face.lips.keypoints[IDX_LIP_UPPER].y,
    face.lips.keypoints[IDX_LIP_LOWER].x,
    face.lips.keypoints[IDX_LIP_LOWER].y
  );
}

function drawFacebox({ xMin, xMax, yMin, yMax }) {
  push();
  noFill();
  stroke(0, 255, 0);
  beginShape();
  vertex(xMin, yMin);
  vertex(xMax, yMin);
  vertex(xMax, yMax);
  vertex(xMin, yMax);
  endShape(CLOSE);
  pop();
}

function drawKeypointsEnds({ keypoints }) {
  const beginPoint = keypoints[0];
  const endPoint = keypoints[keypoints.length - 1];
  push();
  noStroke();
  fill(255, 0, 0);
  circle(beginPoint.x, beginPoint.y, 10);
  fill(0, 0, 255);
  circle(endPoint.x, endPoint.y, 10);
  pop();
}

function drawKeypointsMilestones({ keypoints }) {
  push();
  noStroke();
  textSize(8);
  for (let idx = 0; idx < keypoints.length; idx++) {
    const normal = idx / (keypoints.length - 1);
    fill(normal * 255, 0, (1 - normal) * 255);
    circle(keypoints[idx].x, keypoints[idx].y, 2);
    fill(255);
    text(idx, keypoints[idx].x, keypoints[idx].y);
  }
  pop();
}

function drawBox({ centerX, centerY, width, height }) {
  push();
  rectMode(CENTER);
  noFill();
  stroke(0, 255, 0);
  rect(centerX, centerY, width, height);
  pop();
}

function getDirectionVector({ eyeL, eyeR, nose }) {
  // 벡터 AB (eyeL -> eyeR)와 AC (eyeL -> nose) 구하기
  const AB = { x: eyeR.x - eyeL.x, y: eyeR.y - eyeL.y, z: eyeR.z - eyeL.z };
  const AC = { x: nose.x - eyeL.x, y: nose.y - eyeL.y, z: nose.z - eyeL.z };

  // 외적 계산 (법선 벡터 구하기)
  const normal = {
    x: AB.y * AC.z - AB.z * AC.y, // Nx
    y: AB.z * AC.x - AB.x * AC.z, // Ny
    z: AB.x * AC.y - AB.y * AC.x, // Nz
  };

  // 법선 벡터를 단위 벡터로 정규화
  const magnitude = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
  const unitNormal = {
    x: normal.x / magnitude,
    y: normal.y / magnitude,
    z: normal.z / magnitude,
  };

  // Yaw (좌우 회전 각도) 계산 - 정면을 향할 때 0
  const yaw =
    Math.atan2(-unitNormal.x, unitNormal.z) < 0
      ? Math.PI + Math.atan2(-unitNormal.x, unitNormal.z)
      : -Math.PI + Math.atan2(-unitNormal.x, unitNormal.z);

  // Pitch (위아래 회전 각도) 계산 - 정면을 향할 때 0
  let pitch =
    Math.atan2(-unitNormal.y, unitNormal.z) < 0
      ? -Math.PI - Math.atan2(-unitNormal.y, unitNormal.z)
      : Math.PI - Math.atan2(-unitNormal.y, unitNormal.z);
  // 화면 각도 등에 대한 보상
  pitch += radians(PITCH_COMPENSATION_DEGREES);

  // Roll (좌우 기울기 각도) 계산 - 정수리가 위를 향한 상태가 0
  const roll =
    -Math.atan2(AB.y, AB.x) < 0
      ? -Math.PI + Math.atan2(AB.y, AB.x)
      : Math.PI + Math.atan2(AB.y, AB.x);

  // 결과 반환
  return {
    normal: unitNormal,
    yaw: yaw, // 좌우 회전 각도
    pitch: pitch, // 위아래 회전 각도
    roll: roll, // 좌우 기울기 각도
  };
}

function mousePressed() {
  console.log(faces);
}

function keyPressed() {
  if (keyCode === LEFT_ARROW) {
    selIdx--;
    if (selIdx < 0) selIdx = 0;
  } else if (keyCode === RIGHT_ARROW) {
    selIdx++;
  }
  console.log('selIdx', selIdx);
}

// Callback function for when faceMesh outputs data
function gotFaces(results) {
  // Save the output to the faces variable
  faces = results;
}
