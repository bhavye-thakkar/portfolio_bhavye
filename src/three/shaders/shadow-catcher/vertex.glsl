varying vec2 vUv;
varying vec3 vWorld;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    vUv = uv;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
}
