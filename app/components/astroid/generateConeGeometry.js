export function generateConeGeometry(
  baseRadius,
  height,
  whiteRadiusRatio,
  yellowRadiusRatio
) {
  const sectors = 36;
  const stacks = 30;
  const vertices = [];
  const coneTypes = [];
  const indices = [];
  let vertexIndex = 0;

  for (let coneType = 0; coneType < 2; coneType++) {
    const coneStartIndex = vertexIndex;

    for (let i = 0; i <= stacks; i++) {
      const u = i / stacks;
      const currentRadius = baseRadius * (1 - u);

      for (let j = 0; j <= sectors; j++) {
        const theta = (j / sectors) * 2 * Math.PI;
        const x = currentRadius * Math.cos(theta);
        const y = currentRadius * Math.sin(theta);
        const z = height * u;

        vertices.push(x, y, z);
        coneTypes.push(coneType);

        if (i < stacks && j < sectors) {
          const current = coneStartIndex + i * (sectors + 1) + j;
          const next = coneStartIndex + (i + 1) * (sectors + 1) + j;
          const currentNext =
            coneStartIndex + i * (sectors + 1) + (j + 1);
          const nextNext =
            coneStartIndex + (i + 1) * (sectors + 1) + (j + 1);

          indices.push(current, next, currentNext);
          indices.push(currentNext, next, nextNext);
        }
      }
    }

    const baseCenterIndex = vertexIndex;
    vertices.push(0, 0, height);
    coneTypes.push(coneType);
    vertexIndex++;

    const baseStartIndex = vertexIndex;
    for (let j = 0; j <= sectors; j++) {
      const theta = (j / sectors) * 2 * Math.PI;
      const x = baseRadius * Math.cos(theta);
      const y = baseRadius * Math.sin(theta);
      const z = height;
      vertices.push(x, y, z);
      coneTypes.push(coneType);
      vertexIndex++;
    }

    for (let j = 0; j < sectors; j++) {
      const v1 = baseStartIndex + j;
      const v2 = baseStartIndex + (j + 1);
      indices.push(baseCenterIndex, v1, v2);
    }

    vertexIndex = vertices.length / 3;
  }

  const hemisphereSectors = 36;
  const hemisphereStacks = 18;
  const whiteHemisphereRadius = baseRadius * whiteRadiusRatio;
  const whiteHemisphereStartIndex = vertexIndex;

  for (let i = 0; i <= hemisphereStacks; i++) {
    const phi = Math.PI / 2 - (i / hemisphereStacks) * (Math.PI / 2);
    const currentRadius = whiteHemisphereRadius * Math.sin(phi);

    for (let j = 0; j <= hemisphereSectors; j++) {
      const theta = (j / hemisphereSectors) * 2 * Math.PI;
      const x = currentRadius * Math.cos(theta);
      const y = currentRadius * Math.sin(theta);
      const z = height - whiteHemisphereRadius * Math.cos(phi);

      vertices.push(x, y, z);
      coneTypes.push(0);

      if (i < hemisphereStacks && j < hemisphereSectors) {
        const current =
          whiteHemisphereStartIndex + i * (hemisphereSectors + 1) + j;
        const next =
          whiteHemisphereStartIndex +
          (i + 1) * (hemisphereSectors + 1) +
          j;
        const currentNext =
          whiteHemisphereStartIndex +
          i * (hemisphereSectors + 1) +
          (j + 1);
        const nextNext =
          whiteHemisphereStartIndex +
          (i + 1) * (hemisphereSectors + 1) +
          (j + 1);

        indices.push(current, currentNext, next);
        indices.push(currentNext, nextNext, next);
      }
    }
  }

  vertexIndex = vertices.length / 3;

  const yellowHemisphereRadius =
    baseRadius * (whiteRadiusRatio + yellowRadiusRatio);
  const yellowHemisphereStartIndex = vertexIndex;

  for (let i = 0; i <= hemisphereStacks; i++) {
    const phi = Math.PI / 2 - (i / hemisphereStacks) * (Math.PI / 2);
    const currentRadius = yellowHemisphereRadius * Math.sin(phi);

    for (let j = 0; j <= hemisphereSectors; j++) {
      const theta = (j / hemisphereSectors) * 2 * Math.PI;
      const x = currentRadius * Math.cos(theta);
      const y = currentRadius * Math.sin(theta);
      const z = height - yellowHemisphereRadius * Math.cos(phi);

      vertices.push(x, y, z);
      coneTypes.push(1);

      if (i < hemisphereStacks && j < hemisphereSectors) {
        const current =
          yellowHemisphereStartIndex + i * (hemisphereSectors + 1) + j;
        const next =
          yellowHemisphereStartIndex +
          (i + 1) * (hemisphereSectors + 1) +
          j;
        const currentNext =
          yellowHemisphereStartIndex +
          i * (hemisphereSectors + 1) +
          (j + 1);
        const nextNext =
          yellowHemisphereStartIndex +
          (i + 1) * (hemisphereSectors + 1) +
          (j + 1);

        indices.push(current, currentNext, next);
        indices.push(currentNext, nextNext, next);
      }
    }
  }

  return {
    vertices,
    coneTypes,
    indices,
  };
}





