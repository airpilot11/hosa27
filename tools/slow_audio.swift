// Slows down speech WITHOUT changing the pitch (Apple's AVAudioUnitTimePitch), offline.
// Used by tools/make_voice_audio.py, because Mac Enhanced/Premium voices mostly ignore `say -r`.
// Usage: swift tools/slow_audio.swift <in.aiff> <out.aiff> <rate>     (rate 0.8 = 80% speed)
import AVFoundation

let args = CommandLine.arguments
guard args.count == 4, let rate = Float(args[3]) else {
    FileHandle.standardError.write("usage: slow_audio <in> <out> <rate>\n".data(using: .utf8)!)
    exit(2)
}
func run() throws {
let input = try AVAudioFile(forReading: URL(fileURLWithPath: args[1]))
let format = input.processingFormat
let engine = AVAudioEngine()
let player = AVAudioPlayerNode()
let stretch = AVAudioUnitTimePitch()
stretch.rate = rate
stretch.overlap = 32            // highest quality setting (smoother speech)
engine.attach(player)
engine.attach(stretch)
engine.connect(player, to: stretch, format: format)
engine.connect(stretch, to: engine.mainMixerNode, format: format)
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 4096)
try engine.start()
player.scheduleFile(input, at: nil)
player.play()

let output = try AVAudioFile(forWriting: URL(fileURLWithPath: args[2]), settings: input.fileFormat.settings)
let buffer = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: engine.manualRenderingMaximumFrameCount)!
// expected length after slowing, plus a short tail so the last word isn't cut off
let total = AVAudioFramePosition(Double(input.length) / Double(rate)) + AVAudioFramePosition(format.sampleRate * 0.15)
while engine.manualRenderingSampleTime < total {
    let n = min(AVAudioFrameCount(total - engine.manualRenderingSampleTime), buffer.frameCapacity)
    let status = try engine.renderOffline(n, to: buffer)
    if status == .success { try output.write(from: buffer) } else if status == .error { throw NSError(domain: "slow_audio", code: 1) }
}
engine.stop()
}   // leaving this function closes (finishes writing) the output file
do { try run() } catch { FileHandle.standardError.write("\(error)\n".data(using: .utf8)!); exit(1) }
