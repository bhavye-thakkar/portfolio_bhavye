#include ../includes/avatar-progress/fragment.glsl;
#include ../includes/about-ambient.glsl;

// The Timex dial on his wrist. Sampled raw, the head-texture convention: the
// texture is uploaded as plain bytes and written out as plain bytes, so what
// was drawn on the canvas is what shows. The alpha is the same scan every
// other part of him dissolves by, so the watch never outlives the arm.
uniform sampler2D uDial;

varying vec2 vUv;

void main() {
    vec3 color = texture2D(uDial, vUv).rgb;
    gl_FragColor = vec4(applyAmbient(color), getProgress());
}
