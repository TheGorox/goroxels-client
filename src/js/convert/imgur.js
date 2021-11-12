export async function upload(image){
    const formData = new FormData();
    formData.append('image', image);
    formData.append('type', 'base64');

    const resp = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
            'Authorization': 'Client-ID 134a48816a3c4d6'
        },
        body: formData,
        redirect: 'follow'
    })
    const json = await resp.json();
    if(!json.success) throw new Error('Imgur upload eror');

    return json.data.link;
}

window.imgurUpload = upload;