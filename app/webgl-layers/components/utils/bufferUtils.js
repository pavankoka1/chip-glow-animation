/**
 * WebGL buffer utilities for updating attribute buffers
 */

/**
 * Update all attribute buffers with point data
 */
export function updateAllBuffers(gl, buffers, attribs, points) {
  const positions = new Float32Array(points.length * 2);
  const radii = new Float32Array(points.length);
  const sparkColors = new Float32Array(points.length * 3);
  const alphas = new Float32Array(points.length);
  const along01s = new Float32Array(points.length);
  const glowRadii = new Float32Array(points.length);

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    positions[i * 2] = p.x;
    positions[i * 2 + 1] = p.y;
    radii[i] = p.radius;
    sparkColors[i * 3] = p.color[0];
    sparkColors[i * 3 + 1] = p.color[1];
    sparkColors[i * 3 + 2] = p.color[2];
    alphas[i] = p.alpha;
    along01s[i] = p.along01;
    glowRadii[i] = p.glowRadius;
  }

  // Position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(attribs.position);
  gl.vertexAttribPointer(attribs.position, 2, gl.FLOAT, false, 0, 0);

  // Radius buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.radius);
  gl.bufferData(gl.ARRAY_BUFFER, radii, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(attribs.radius);
  gl.vertexAttribPointer(attribs.radius, 1, gl.FLOAT, false, 0, 0);

  // Spark color buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.sparkColor);
  gl.bufferData(gl.ARRAY_BUFFER, sparkColors, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(attribs.sparkColor);
  gl.vertexAttribPointer(attribs.sparkColor, 3, gl.FLOAT, false, 0, 0);

  // Alpha buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.alpha);
  gl.bufferData(gl.ARRAY_BUFFER, alphas, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(attribs.alpha);
  gl.vertexAttribPointer(attribs.alpha, 1, gl.FLOAT, false, 0, 0);

  // Along01 buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.along01);
  gl.bufferData(gl.ARRAY_BUFFER, along01s, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(attribs.along01);
  gl.vertexAttribPointer(attribs.along01, 1, gl.FLOAT, false, 0, 0);

  // Glow radius buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.glowRadius);
  gl.bufferData(gl.ARRAY_BUFFER, glowRadii, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(attribs.glowRadius);
  gl.vertexAttribPointer(attribs.glowRadius, 1, gl.FLOAT, false, 0, 0);
}

