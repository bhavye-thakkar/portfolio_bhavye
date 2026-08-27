#include ../includes/avatar-progress/fragment.glsl;
#include ../includes/about-ambient.glsl;

uniform sampler2D uHeadTexture;
uniform vec2 uHeadTextureSize;

varying vec2 vUv;

/**
 * Hair and skin share one atlas, but they sit either side of a wide gap in
 * luminance (hair tops out around 0.62, skin starts around 0.70), so the hair
 * can be re-tinted without touching the face. HAIR_TINT multiplies the sampled
 * colour — lower it to darken, shift the channels to warm or cool it.
 */
#define HAIR_TINT vec3(0.34, 0.28, 0.25)
#define HAIR_LUM_LOW 0.62
#define HAIR_LUM_HIGH 0.70

void main() {
    vec4 tex = texture2D(uHeadTexture, vUv);

    float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    float hair = 1.0 - smoothstep(HAIR_LUM_LOW, HAIR_LUM_HIGH, lum);
    vec3 color = mix(tex.rgb, tex.rgb * HAIR_TINT, hair);

    float progress = getProgress();

    gl_FragColor = vec4(applyAmbient(color), progress);
}
