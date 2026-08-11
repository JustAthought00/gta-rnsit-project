import { useState, useEffect } from 'react';
import { X, MessageCircle, Send, Phone, Video, Info, Search, ArrowLeft, Users as UsersIcon, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

interface CommunityMessage {
  id: string;
  community_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

interface Conversation {
  id: string;
  other_user_id: string;
  other_user_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

interface Community {
  id: string;
  name: string;
  description: string | null;
  last_message?: string;
  last_message_time?: string;
  member_count?: number;
}

interface UserSearchResult {
  user_id: string;
  full_name: string;
  department: string | null;
}

interface MessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

const MessagesModal = ({ isOpen, onClose, currentUser }: MessagesModalProps) => {
  const [activeTab, setActiveTab] = useState<'direct' | 'communities'>('direct');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [communityMessages, setCommunityMessages] = useState<CommunityMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadConversations();
      loadCommunities();
      setShowNewConversation(false);
      setUserSearchTerm('');
      setSearchResults([]);
    }
  }, [isOpen, currentUser]);

  // Listen for openMessages event from notifications
  useEffect(() => {
    const handleOpenMessages = (event: CustomEvent) => {
      if (event.detail?.conversationUserId) {
        setSelectedConversation(event.detail.conversationUserId);
        loadMessages(event.detail.conversationUserId);
      }
    };

    window.addEventListener('openMessages', handleOpenMessages as EventListener);
    return () => {
      window.removeEventListener('openMessages', handleOpenMessages as EventListener);
    };
  }, []);

  // Search for users
  useEffect(() => {
    const searchUsers = async () => {
      if (!userSearchTerm.trim() || userSearchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, department')
        .neq('user_id', currentUser?.id || '')
        .ilike('full_name', `%${userSearchTerm}%`)
        .limit(10);

      if (!error && data) {
        setSearchResults(data);
      }
      setIsSearching(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [userSearchTerm, currentUser]);

  // Set up realtime subscription for messages
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === currentUser.id || newMsg.receiver_id === currentUser.id) {
            if (selectedConversation) {
              const convUserId = selectedConversation;
              if (newMsg.sender_id === convUserId || newMsg.receiver_id === convUserId) {
                setMessages(prev => [...prev, newMsg]);
              }
            }
            loadConversations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, currentUser, selectedConversation]);

  const loadConversations = async () => {
    if (!currentUser) return;

    const { data: sentMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('sender_id', currentUser.id)
      .order('created_at', { ascending: false });

    const { data: receivedMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver_id', currentUser.id)
      .order('created_at', { ascending: false });

    const allMessages = [...(sentMessages || []), ...(receivedMessages || [])];
    
    // Get unique user IDs
    const userIds = new Set<string>();
    allMessages.forEach(msg => {
      if (msg.sender_id !== currentUser.id) userIds.add(msg.sender_id);
      if (msg.receiver_id !== currentUser.id) userIds.add(msg.receiver_id);
    });

    // Fetch profiles
    if (userIds.size > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(userIds));
      
      const profileMap = new Map<string, string>();
      profilesData?.forEach(p => profileMap.set(p.user_id, p.full_name));
      setProfiles(profileMap);
    }

    // Group by conversation
    const conversationsMap = new Map<string, Conversation>();
    allMessages.forEach(msg => {
      const otherUserId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
      
      if (!conversationsMap.has(otherUserId)) {
        conversationsMap.set(otherUserId, {
          id: otherUserId,
          other_user_id: otherUserId,
          other_user_name: profiles.get(otherUserId) || 'User',
          last_message: msg.content,
          last_message_time: msg.created_at,
          unread_count: 0
        });
      }

      const conv = conversationsMap.get(otherUserId)!;
      if (new Date(msg.created_at) > new Date(conv.last_message_time)) {
        conv.last_message = msg.content;
        conv.last_message_time = msg.created_at;
      }
      if (!msg.read && msg.receiver_id === currentUser.id) {
        conv.unread_count++;
      }
    });

    // Update names from profiles
    const { data: freshProfiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', Array.from(conversationsMap.keys()));
    
    freshProfiles?.forEach(p => {
      const conv = conversationsMap.get(p.user_id);
      if (conv) conv.other_user_name = p.full_name;
    });

    setConversations(Array.from(conversationsMap.values())
      .sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()));
  };

  const loadCommunities = async () => {
    if (!currentUser) return;

    // Get communities the user is a member of
    const { data: memberships } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', currentUser.id);

    if (!memberships || memberships.length === 0) {
      setCommunities([]);
      return;
    }

    const communityIds = memberships.map(m => m.community_id);
    
    const { data: communitiesData } = await supabase
      .from('communities')
      .select('*')
      .in('id', communityIds);

    setCommunities(communitiesData || []);
  };

  const loadMessages = async (otherUserId: string) => {
    if (!currentUser) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });

    setMessages(data || []);

    // Mark as read
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', currentUser.id);

    loadConversations();
  };

  const loadCommunityMessages = async (communityId: string) => {
    const { data } = await supabase
      .from('community_messages')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: true });

    // Fetch sender names
    if (data && data.length > 0) {
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: senderProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', senderIds);
      
      const senderMap = new Map(senderProfiles?.map(p => [p.user_id, p.full_name]) || []);
      
      setCommunityMessages(data.map(msg => ({
        ...msg,
        sender_name: senderMap.get(msg.sender_id) || 'Unknown'
      })));
    } else {
      setCommunityMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    if (activeTab === 'direct' && selectedConversation) {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: selectedConversation,
          content: newMessage.trim()
        });

      if (error) {
        toast.error('Failed to send message');
        return;
      }

      setNewMessage('');
      loadMessages(selectedConversation);
    } else if (activeTab === 'communities' && selectedCommunity) {
      const { error } = await supabase
        .from('community_messages')
        .insert({
          community_id: selectedCommunity,
          sender_id: currentUser.id,
          content: newMessage.trim()
        });

      if (error) {
        toast.error('Failed to send message');
        return;
      }

      setNewMessage('');
      loadCommunityMessages(selectedCommunity);
    }
  };

  const startNewConversation = async (user: UserSearchResult) => {
    // Send an initial greeting message
    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUser.id,
        receiver_id: user.user_id,
        content: `👋 Hi ${user.full_name.split(' ')[0]}!`
      });

    if (error) {
      toast.error('Failed to start conversation');
      return;
    }

    toast.success(`Started conversation with ${user.full_name}`);
    setShowNewConversation(false);
    setUserSearchTerm('');
    setSearchResults([]);
    setSelectedConversation(user.user_id);
    loadMessages(user.user_id);
    loadConversations();
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);

    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredConversations = conversations.filter(c =>
    c.other_user_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCommunities = communities.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBack = () => {
    setSelectedConversation(null);
    setSelectedCommunity(null);
    setMessages([]);
    setCommunityMessages([]);
  };

  if (!isOpen) return null;

  // Show message if not authenticated
  if (!currentUser) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-background rounded-xl p-8 max-w-md text-center border border-border">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to access your messages.</p>
          <Button onClick={onClose} className="plasma-button text-primary-foreground">
            Close
          </Button>
        </div>
      </div>
    );
  }

  const showConversationList = !selectedConversation && !selectedCommunity && !showNewConversation;
  const currentConversation = conversations.find(c => c.id === selectedConversation);
  const currentCommunity = communities.find(c => c.id === selectedCommunity);

  // Render new conversation search panel
  const renderNewConversationPanel = () => (
    <div className="flex-1 flex flex-col bg-background">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowNewConversation(false);
              setUserSearchTerm('');
              setSearchResults([]);
            }}
            className="p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground">New Conversation</h2>
        </div>
      </div>
      
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for users..."
            value={userSearchTerm}
            onChange={(e) => setUserSearchTerm(e.target.value)}
            className="pl-10 bg-muted border-border"
            autoFocus
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1 px-4">
        {isSearching ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Searching...</p>
          </div>
        ) : userSearchTerm.length < 2 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Type at least 2 characters to search</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {searchResults.map((user) => (
              <div
                key={user.user_id}
                onClick={() => startNewConversation(user)}
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{user.full_name}</p>
                  {user.department && (
                    <p className="text-xs text-muted-foreground">{user.department}</p>
                  )}
                </div>
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4">
      <div className="w-full max-w-4xl h-full md:h-[600px] mx-auto bg-background md:rounded-xl overflow-hidden shadow-2xl flex border border-border">
        {/* Conversations/Communities List */}
        <div className={`w-full md:w-1/3 border-r border-border bg-background ${!showConversationList ? 'hidden md:block' : 'block'}`}>
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm">
                    {currentUser?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-lg md:text-xl font-semibold text-foreground">{currentUser?.fullName?.split(' ')[0] || 'Messages'}</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-muted p-2 text-foreground">
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'direct' | 'communities')} className="mb-3">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="direct" className="text-sm">
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Direct
                </TabsTrigger>
                <TabsTrigger value="communities" className="text-sm">
                  <UsersIcon className="h-4 w-4 mr-1" />
                  Communities
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-muted border-border rounded-lg text-foreground placeholder:text-muted-foreground"
              />
            </div>
            
            {/* New Conversation Button */}
            {activeTab === 'direct' && (
              <div className="px-4 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewConversation(true)}
                  className="w-full border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Conversation
                </Button>
              </div>
            )}
          </div>
          
          {/* List */}
          <ScrollArea className="h-[calc(100vh-250px)] md:h-[350px]">
            {activeTab === 'direct' ? (
              <div className="p-0">
                {filteredConversations.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 px-4">
                    <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-base font-medium text-foreground">No Messages Yet</p>
                    <p className="text-sm">Click "New Conversation" to start chatting!</p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => {
                        setSelectedConversation(conversation.id);
                        loadMessages(conversation.id);
                      }}
                      className="p-3 md:p-4 cursor-pointer transition-all duration-200 hover:bg-muted active:bg-muted/80"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm">
                            {getInitials(conversation.other_user_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-foreground truncate text-sm">
                              {conversation.other_user_name}
                            </p>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-muted-foreground">
                                {formatTime(conversation.last_message_time)}
                              </span>
                              {conversation.unread_count > 0 && (
                                <div className="w-2 h-2 bg-primary rounded-full"></div>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {conversation.last_message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="p-0">
                {filteredCommunities.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 px-4">
                    <UsersIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-base font-medium text-foreground">No Communities</p>
                    <p className="text-sm">Join a skill or activity community!</p>
                  </div>
                ) : (
                  filteredCommunities.map((community) => (
                    <div
                      key={community.id}
                      onClick={() => {
                        setSelectedCommunity(community.id);
                        loadCommunityMessages(community.id);
                      }}
                      className="p-3 md:p-4 cursor-pointer transition-all duration-200 hover:bg-muted active:bg-muted/80"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                          <UsersIcon className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate text-sm">
                            {community.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {community.description || 'Community chat'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Messages Area or New Conversation Panel */}
        <div className={`flex-1 flex flex-col bg-background ${showConversationList ? 'hidden md:flex' : 'flex'}`}>
          {showNewConversation ? (
            renderNewConversationPanel()
          ) : (selectedConversation || selectedCommunity) ? (
            <>
              {/* Chat Header */}
              <div className="p-3 md:p-4 border-b border-border bg-background">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="md:hidden p-2 mr-2 text-foreground hover:bg-muted"
                      onClick={handleBack}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    {selectedConversation ? (
                      <>
                        <Avatar className="h-8 md:h-10 w-8 md:w-10">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm">
                            {getInitials(currentConversation?.other_user_name || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-foreground text-sm md:text-base">
                            {currentConversation?.other_user_name}
                          </h3>
                          <p className="text-xs text-muted-foreground">Active now</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="h-8 md:h-10 w-8 md:w-10 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                          <UsersIcon className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground text-sm md:text-base">
                            {currentCommunity?.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">Community chat</p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 md:space-x-2">
                    <Button variant="ghost" size="sm" className="hover:bg-muted p-2 text-foreground" onClick={() => toast.info('Voice calls coming soon!')}>
                      <Phone className="h-4 md:h-5 w-4 md:w-5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="hover:bg-muted p-2 text-foreground" onClick={() => toast.info('Video calls coming soon!')}>
                      <Video className="h-4 md:h-5 w-4 md:w-5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="hover:bg-muted p-2 md:block hidden text-foreground">
                      <Info className="h-4 md:h-5 w-4 md:w-5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-3 md:px-6 py-3 md:py-4 bg-background">
                <div className="space-y-3 md:space-y-4">
                  {selectedConversation ? (
                    messages.map((message, index) => {
                      const isFromMe = message.sender_id === currentUser?.id;
                      const showTime = index === 0 || 
                        new Date(message.created_at).getTime() - new Date(messages[index - 1]?.created_at).getTime() > 300000;
                      
                      return (
                        <div key={message.id}>
                          {showTime && (
                            <div className="text-center text-xs text-muted-foreground mb-3">
                              {formatMessageTime(message.created_at)}
                            </div>
                          )}
                          <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[280px] md:max-w-xs lg:max-w-sm px-3 md:px-4 py-2 rounded-2xl ${
                              isFromMe
                                ? 'bg-primary text-primary-foreground ml-2 md:ml-4'
                                : 'bg-muted text-foreground mr-2 md:mr-4'
                            }`}>
                              <p className="text-sm leading-relaxed">{message.content}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    communityMessages.map((message, index) => {
                      const isFromMe = message.sender_id === currentUser?.id;
                      const showTime = index === 0 || 
                        new Date(message.created_at).getTime() - new Date(communityMessages[index - 1]?.created_at).getTime() > 300000;
                      
                      return (
                        <div key={message.id}>
                          {showTime && (
                            <div className="text-center text-xs text-muted-foreground mb-3">
                              {formatMessageTime(message.created_at)}
                            </div>
                          )}
                          <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[280px] md:max-w-xs lg:max-w-sm ${!isFromMe ? 'mr-2 md:mr-4' : 'ml-2 md:ml-4'}`}>
                              {!isFromMe && (
                                <p className="text-xs text-muted-foreground mb-1">{message.sender_name}</p>
                              )}
                              <div className={`px-3 md:px-4 py-2 rounded-2xl ${
                                isFromMe
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-foreground'
                              }`}>
                                <p className="text-sm leading-relaxed">{message.content}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-3 md:p-4 border-t border-border bg-background">
                <div className="flex items-center space-x-2 md:space-x-3">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      className="rounded-2xl border-border pl-4 pr-12 bg-muted text-foreground placeholder:text-muted-foreground text-sm md:text-base py-2 md:py-2.5"
                    />
                    {newMessage.trim() && (
                      <Button
                        onClick={sendMessage}
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-6 w-6 p-1"
                      >
                        <Send className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-background">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                  <MessageCircle className="h-12 w-12 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">Your Messages</h3>
                <p className="text-muted-foreground mb-4">Select a conversation to start chatting</p>
                <Button
                  onClick={() => setShowNewConversation(true)}
                  className="plasma-button text-primary-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start New Conversation
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesModal;