use wasm_bindgen::prelude::*;
use js_sys::*;
mod vecmath;

#[wasm_bindgen]
extern {
    fn alert(s: &str);

    #[wasm_bindgen(js_namespace = console, js_name = log)]
    fn console_log(s: &str);
}

#[wasm_bindgen]
pub fn add(x: f64, y: f64) -> f64 {
    x + y
}

#[wasm_bindgen]
pub fn greet() {
    alert("From WASM, with love.");
}

#[wasm_bindgen]
pub fn accept_array(a: &[f32]) {
    alert(&format!("a.len() = {}", a.len()));
    for i in 0 .. a.len() {
        console_log(&format!("a[{}] = {}", i, a[i]));
    }
}

#[wasm_bindgen]
pub fn gen_array() -> Float32Array {
    let a = vec![1.23, 3.45, 6.78];
    a.as_slice().into()
}