#! /bin/bash
cargo build --target=wasm32-unknown-unknown
wasm-bindgen --target web target/wasm32-unknown-unknown/debug/wasmlib.wasm --out-dir ..
exit 0

