param (
    [string]$docxPath,
    [string]$outputPath
)

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
    $entry = $zip.GetEntry("word/document.xml")
    if ($null -eq $entry) {
        Write-Error "Could not find word/document.xml in zip archive"
        $zip.Dispose()
        exit 1
    }
    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $xmlText = $reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    $zip.Dispose()

    [xml]$xml = $xmlText
    $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
    
    # Let's iterate through paragraphs (w:p) to preserve paragraph line breaks
    $paragraphs = $xml.SelectNodes("//w:p", $ns)
    $lines = New-Object System.Collections.Generic.List[string]
    
    foreach ($p in $paragraphs) {
        $tNodes = $p.SelectNodes(".//w:t", $ns)
        $pText = ""
        foreach ($t in $tNodes) {
            $pText += $t.InnerText
        }
        $lines.Add($pText)
    }

    $lines | Out-File -FilePath $outputPath -Encoding utf8
    Write-Host "Successfully wrote $docxPath text to $outputPath"
} catch {
    Write-Error $_.Exception.Message
}
