use std::ops::*;

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct Vec3<T> { pub x: T, pub y: T, pub z: T }

impl<T: Add> Add for Vec3<T> {
    type Output = Vec3<T::Output>;
    fn add(self, v: Self) -> Self::Output {
        Self::Output{ x: self.x + v.x, y: self.y + v.y, z: self.z + v.z }
    }
}