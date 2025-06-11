// app/page.tsx
'use client';
import { useState, useRef,useEffect} from 'react';

export default function VillageSongGenerator() {
  // ========== 状态管理 ==========
  // 歌词相关状态
  const [villagePrompt, setVillagePrompt] = useState('');
  const [songData, setSongData] = useState<{ title: string; lyrics: string } | null>(null);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  
  // 音乐相关状态
  const [musicPrompt, setMusicPrompt] = useState(''); // 新增：独立音乐输入
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false); // 新增：独立音乐生成状态

  //新增轮询定义
  const [pollCount,setPollCount]=useState(0);
  const [maxPolls,setMaxPolls]=useState(18);
  const pollTimeoutRef=useRef<NodeJS.Timeout | null>(null);

  //新增组件卸载时清除定时器
  useEffect(()=>{
    return()=>{
      if(pollTimeoutRef.current){
        clearTimeout(pollTimeoutRef.current);
      }
    };
  },[]);


  const audioRef = useRef<HTMLAudioElement>(null);

  // ========== 核心功能函数 ==========
  /**
   * 生成歌词（基于乡村场景描述）
   * 使用DeepSeek API生成具有乡村特色的歌词
   */
  const generateLyrics = async () => {
    if (!villagePrompt.trim()) return;
    
    setIsGeneratingLyrics(true);
    
    try {
      // 真实DeepSeek API调用
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: "你是一位精通中国乡村文化的作词家，请根据用户提供的乡村描述创作一首具有地方特色的歌曲。歌曲结构包含主歌、副歌和尾声。"
            },
            {
              role: "user",
              content: `请依据此创作音乐歌词歌名：${villagePrompt}`
            }
          ]
        })
      });
      
      const data = await response.json();
      const lyrics = data.choices[0].message.content;
      
      // 提取歌名（假设第一行是歌名）
      const title = lyrics.split('\n')[0].replace(/^【(.+)】$/, '$1') || `${villagePrompt}之歌`;
      
      setSongData({ title, lyrics });
    } catch (error) {
      console.error("歌词生成失败:", error);
      alert("歌词生成失败，请重试");
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  /*
  轮询音乐生成状态
  **/
    const pollForMusic = async (taskId: string): Promise<string> => {
    const POLL_INTERVAL = 5000; // 5秒轮询一次
    
    try {
      const statusRes = await fetch(`https://apibox.erweima.ai/api/v1/status/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUNO_API_KEY}`
        }
      });
      
      // 更新轮询次数
      setPollCount(prev => prev + 1);
      
      if (!statusRes.ok) {
        const errorData = await statusRes.json();
        throw new Error(errorData.message || '状态检查出错');
      }
      
      const statusData = await statusRes.json();
      
      // 检查任务完成状态
      if (statusData.status === 'complete' && statusData.data?.[0]?.audio_url) {
        return statusData.data[0].audio_url;
      }
      
      // 继续轮询 - 返回一个明确的 Promise
      return new Promise<string>((resolve, reject) => {
        pollTimeoutRef.current = setTimeout(async () => {
          try {
            const result = await pollForMusic(taskId);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, POLL_INTERVAL);
      });
      
    } catch (error) {
      console.error("轮询出错:", error);
      throw error;
    }
  };

  /**
   * 生成音乐（独立功能，不依赖歌词）
   * 根据任意文本输入生成音乐
   */
  const generateMusic = async () => {
    if (!musicPrompt.trim()) return;
    
    setIsGeneratingMusic(true);
    setMusicUrl(null);
    setPollCount(0); // 重置轮询计数器

    try {
      //获取当前域名用于回调url
      //const baseUrl=window.location.origin;baseURL已经不需要了0611晚
      const callBackUrl=`http://47.120.72.4/api/generate-music`;//0611晚替换为阿里云服务器的公网IP
      //Until0612I cant access my server.damn...
      const requestBody = {
        prompt: musicPrompt.substring(0, 400),
        customMode: false,
        instrumental: false,
        model: "V4",
        callBackUrl, //060921:17更改
        style: "",
        title: "",
        negativeTags: ""
      };
      
      const response = await fetch('https://apibox.erweima.ai/api/v1/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUNO_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '音乐生成出错');
      }
      
      const result = await response.json();
      console.log("音乐生成返回数据",result);//0611添加调试日志输出
      // 生成任务ID解析
      const taskId =  result?.data?.taskId;// 不同API可能使用不同字段名,故更改“result.task_id || result.id;”

      if (!taskId) {
        //0610新增
        console.error("完整返回结果:",result);//返回调试信息
        throw new Error('未接收到有效任务ID');
      }
      // 开始轮询获取音频URL
      const audioUrl = await pollForMusic(taskId);
      
      // 设置并播放音乐
      if (audioUrl) {
        setMusicUrl(audioUrl);
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("播放失败:", e));
          }
        }, 500);
      } else {
        throw new Error('没有有效音频URL');
      }
    } catch (error) {
      console.error("音乐生成失败:", error);
      alert(`音乐生成失败:${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGeneratingMusic(false);
    }
  };
  

 


    /*
    try {
      // 模拟真实API调用（实际替换为SunoAI等音乐生成API）
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 示例音乐URL - 实际项目中替换为API返回的音频URL
      const mockAudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
      setMusicUrl(mockAudioUrl);
      
      // 自动播放生成的音乐
      setTimeout(() => audioRef.current?.play(), 500);
    } catch (error) {
      console.error("音乐生成失败:", error);
      alert("音乐生成失败，请重试");
    } finally {
      setIsGeneratingMusic(false);
    }
     **/
    

  // 复制歌词到剪贴板
  const copyLyrics = () => {
    if (songData?.lyrics) {
      navigator.clipboard.writeText(songData.lyrics);
      alert("歌词已复制！");
    }
  };

  // ========== UI渲染 ==========
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-800 to-cyan-300 p-6">
      <div className="max-w-3xl mx-auto">
        <header className="text-center py-8">
          <h1 className="text-5xl font-bold text-emerald-300">辞喻音声</h1>
          <p className="mt-4 text-1xl text-white">智能歌词&音乐生成功能祝您平步青云！</p>
        </header>

        {/* 双栏布局容器 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          
          {/* 歌词生成区 - 左侧 */}
          <div className="bg-green-50 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-green-700">歌词生成</h2>
            <div className="flex">
              <textarea
                value={villagePrompt}
                onChange={(e) => setVillagePrompt(e.target.value)}
                placeholder="描述乡村场景（如：江南水乡的清晨炊烟...）"//需要加入提示词提示用户
                className="flex-1 px-4 h-32 border border-green-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={isGeneratingLyrics || isGeneratingMusic}
              />
              <button
                onClick={generateLyrics}
                disabled={isGeneratingLyrics || !villagePrompt.trim()}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-r-lg disabled:bg-gray-400 transition-colors"
              >
                {isGeneratingLyrics ? "生成中..." : "生成歌词"}
              </button>
            </div>
          </div>

          {/* 音乐生成区 - 右侧 */}
          <div className="bg-blue-50 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-blue-700">音乐生成</h2>
            <div className="flex">
              <textarea
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                placeholder="输入任意文字生成音乐（如：欢快的乡村小调...）"
                className="flex-1 px-4 h-32 border border-blue-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isGeneratingMusic || isGeneratingLyrics}
              />
              <button
                onClick={generateMusic}
                disabled={isGeneratingMusic || !musicPrompt.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-r-lg disabled:bg-gray-400 transition-colors"
              >
                {isGeneratingMusic ? "生成中..." : "生成音乐"}
              </button>
            </div>
          </div>
        </div>

        {/* 结果展示区 */}
        {songData && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all mb-8">
            <div className="bg-green-700 text-white p-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold">{songData.title}</h2>
              <div className="flex space-x-2">
                <button 
                  onClick={copyLyrics}
                  className="bg-white text-green-700 px-3 py-1 rounded-md hover:bg-green-50 transition-colors"
                >
                  复制歌词
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <pre className="whitespace-pre-wrap font-sans text-gray-800 bg-amber-50 p-4 rounded-lg border border-amber-200">
                {songData.lyrics}
              </pre>
            </div>
          </div>
        )}

        {/* 音乐播放器（独立显示） */}
        {musicUrl && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-blue-700 mb-4">生成音乐</h2>
            <audio 
              ref={audioRef}
              src={musicUrl} 
              controls 
              className="w-full"
            />
            <div className="mt-3 text-sm text-gray-500">
              <p>提示：音乐生成可能需要1-3分钟，此处使用示例音频模拟</p>
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-green-200">
          <h3 className="text-xl font-semibold text-green-700 mb-3">歌词生成引导：</h3>
          <p className="mt-4 text-1xl text-black">精准的提示词能更快让AI明白您的需求！</p>
          <p className="mt-1 text-1xl text-red-300">以下为参考</p>
          <p className="mt-4 text-1xl text-black"></p>
          <ol className="list-decimal pl-5 space-y-2 text-gray-600">
            <li><strong>地理坐标</strong>：通过经纬度/地名构建空间记忆锚点</li>
            <li><strong>地貌特征</strong>：具有标识性的自然元素，如某种地貌、晒谷场等</li>
            <li><strong>人文地理</strong>：融合人类活动的地理印记</li>
            <li><strong>气候韵律</strong>：将自然节律转化为节奏型</li>
            <li><strong>风景蒙太奇</strong>:声音元素作拼贴以产生别样效果</li>
            <li><strong>人文地理隐喻</strong>:符号化表达地理人文特征，做到简辞赋义</li>
          </ol>
        </div>
      </div>
    </div>
  );
}