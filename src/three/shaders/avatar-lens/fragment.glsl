#include ../includes/avatar-progress/fragment.glsl;
#include ../includes/about-ambient.glsl;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    vec3 viewDir = normalize(vViewPosition);
    vec3 normal = normalize(vNormal);
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0);
    vec3 color = applyAmbient(vec3(1.0));
    gl_FragColor = vec4(color, getProgress() * (0.05 + 0.12 * fresnel));
}
