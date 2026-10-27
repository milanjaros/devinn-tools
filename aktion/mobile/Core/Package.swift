// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AktionCore",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [.library(name: "AktionCore", targets: ["AktionCore"])],
    targets: [
        .target(name: "AktionCore"),
        .testTarget(name: "AktionCoreTests", dependencies: ["AktionCore"])
    ]
)
